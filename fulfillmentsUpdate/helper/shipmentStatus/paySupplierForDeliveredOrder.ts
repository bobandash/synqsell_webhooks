import { PoolClient } from 'pg';
import { getDbFulfillmentIdFromSupplier } from '../util';
import getSessionFromShop from '../util/getSessionFromShop';
import { Payload, Session } from '../../types';
import { getStripe } from '../../stripe';
import createMapIdToRestObj from '../../util/createMapToRestObj';
import { uuid } from 'uuidv4';
import { PAYMENT_STATUS } from '../../constants';

type SupplierOrderLineItem = {
    shopifySupplierOrderLineItemId: string;
    quantityFulfilled: number;
};

type OrderDatabase = {
    id: string;
    currency: string;
    shopifyRetailerFulfillmentOrderId: string;
    shopifySupplierOrderId: string;
    retailerId: string;
    supplierId: string;
    shippingCost: number;
    paymentStatus: string;
    createdAt: Date;
    updatedAt: Date;
};

type OrderLineItemDetail = {
    id: string;
    retailerShopifyVariantId: string;
    supplierShopifyVariantId: string;
    retailPricePerUnit: number;
    amountPayablePerUnit: number;
    shopifyRetailerOrderLineItemId: string;
    shopifySupplierOrderLineItemId: string;
    quantity: number;
    quantityFulfilled: number;
    quantityPaid: number;
    quantityCancelled: number;
    orderId: string;
    priceListId: string;
};

// ==============================================================================================================
// START: CALCULATE AMOUNT TO PAY SUPPLIER LOGIC
// ==============================================================================================================

async function getDbOrderDetails(shopifySupplierOrderId: string, client: PoolClient) {
    try {
        const query = `
        SELECT * FROM "Order"
        WHERE "shopifySupplierOrderId" = $1
        LIMIT 1
      `;
        const res = await client.query(query, [shopifySupplierOrderId]);
        if (res.rows.length === 0) {
            throw new Error(`No order exists for shopifySupplierOrderId ${shopifySupplierOrderId}.`);
        }
        return res.rows[0] as OrderDatabase;
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to get database order details from ${shopifySupplierOrderId}.`);
    }
}

async function getOrderTotalQuantity(dbOrderId: string, client: PoolClient) {
    try {
        const query = `
        SELECT SUM(quantity) as "totalQty"
        FROM "OrderLineItem"
        WHERE "orderId" = $1
      `;
        const result = await client.query(query, [dbOrderId]);
        if (result.rows.length === 0 || result.rows[0].totalQty === 0) {
            throw new Error(`dbOrderId ${dbOrderId} has no quantity`);
        }

        return result.rows[0].totalQty as number;
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to get total order quantity from dbOrderId ${dbOrderId}.`);
    }
}

async function getShippingTotalPaidToDate(dbOrderId: string, client: PoolClient) {
    try {
        const query = `
        SELECT SUM("shippingPaid") AS totalShippingPaid
        FROM "Payment"
        WHERE "orderId" = $1
      `;
        const res = await client.query(query, [dbOrderId]);
        if (res.rows.length === 0) {
            return 0;
        }
        return res.rows[0].totalShippingPaid as number;
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to get shipping total paid to date ${dbOrderId}.`);
    }
}

async function getShippingPayableAmount(
    dbOrderId: string,
    orderTotalShippingCost: number,
    totalFulfillmentQty: number,
    client: PoolClient,
) {
    const orderTotalQty = await getOrderTotalQuantity(dbOrderId, client);
    const shippingPayableAmountEstimate = Number(
        (orderTotalShippingCost * (totalFulfillmentQty / orderTotalQty)).toFixed(2),
    );
    const shippingTotalPaidToDate = await getShippingTotalPaidToDate(dbOrderId, client);
    const difference = orderTotalShippingCost - shippingPayableAmountEstimate - shippingTotalPaidToDate;
    // handle case there's rounding errors for shipping price
    // e.g. 5 / 3 = 1.33 --> 1.33 * 3 = 4.99; missing 0.01
    let shippingPayableAmount = shippingPayableAmountEstimate;
    // TODO: Figure out whether or not we need to increase the threshold
    if (Math.abs(difference) <= 0.1) {
        shippingPayableAmount += difference;
    }
    return Math.max(shippingPayableAmount, 0);
}

async function getOrderLineItemDetails(dbOrderId: string, client: PoolClient) {
    try {
        const query = `
        SELECT * FROM "OrderLineItem" 
        WHERE "orderId" = $1
      `;
        const res = await client.query(query, [dbOrderId]);
        if (res.rows.length === 0) {
            throw new Error(`No order line items exist for dbOrder ${dbOrderId}.`);
        }
        return res.rows as OrderLineItemDetail[];
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to get database order line items from ${dbOrderId}.`);
    }
}

async function getOrderPayableAmount(
    dbOrderId: string,
    supplierOrderLineItems: SupplierOrderLineItem[],
    client: PoolClient,
) {
    try {
        const entireOrderLineItemDetails = await getOrderLineItemDetails(dbOrderId, client);
        const entireOrderLineItemLookup = createMapIdToRestObj(
            entireOrderLineItemDetails,
            'shopifySupplierOrderLineItemId',
        ); // this is a map of shopifySupplierOrderLineItemId = key to rest of order line item details
        const orderPayableAmount = supplierOrderLineItems.reduce((acc, lineItem) => {
            const { shopifySupplierOrderLineItemId, quantityFulfilled } = lineItem;
            const entireOrderLineItem = entireOrderLineItemLookup.get(shopifySupplierOrderLineItemId);
            if (!entireOrderLineItem) {
                throw new Error(
                    `No order line item exists in the database for shopifySupplierOrderLineItemId ${shopifySupplierOrderLineItemId}`,
                );
            }
            const {
                amountPayablePerUnit,
                quantity: totalQuantityOrdered,
                quantityPaid: totalQuantityPaid,
                quantityCancelled: totalQuantityCancelled,
                quantityFulfilled: totalQuantityFulfilled,
            } = entireOrderLineItem;
            // if it ever throws these errors, have to investigate because do not want the retailer to be charged more than the total order
            // NOTE: these errors are more of a sanity check, it most likely will never been thrown
            if (totalQuantityCancelled + totalQuantityFulfilled + quantityFulfilled > totalQuantityOrdered) {
                throw new Error(
                    `The number of fulfilled items will exceed the total quantity ordered if shopifySupplierOrderLineItemId ${shopifySupplierOrderLineItemId} goes through.`,
                );
            } else if (totalQuantityPaid + quantityFulfilled > totalQuantityOrdered) {
                throw new Error(
                    `The number of items paid will exceed the total quantity ordered if shopifySupplierOrderLineItemId ${shopifySupplierOrderLineItemId} goes through.`,
                );
            }
            const orderPayable = amountPayablePerUnit * lineItem.quantityFulfilled;
            return acc + orderPayable;
        }, 0);

        return orderPayableAmount;
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to order payable amount from ${dbOrderId}.`);
    }
}

async function getPayableAmounts(
    orderDetails: OrderDatabase,
    supplierOrderLineItems: SupplierOrderLineItem[],
    client: PoolClient,
) {
    // NOTE: order lines represents the order line items inside the fulfilment

    const totalFulfillmentQty = supplierOrderLineItems.reduce(
        (acc, { quantityFulfilled }) => acc + quantityFulfilled,
        0,
    );
    const [shippingPayableAmount, orderPayableAmount] = await Promise.all([
        getShippingPayableAmount(orderDetails.id, orderDetails.shippingCost, totalFulfillmentQty, client),
        getOrderPayableAmount(orderDetails.id, supplierOrderLineItems, client),
    ]);

    return { shippingPayableAmount, orderPayableAmount };
}

// ==============================================================================================================
// END: CALCULATE AMOUNT TO PAY SUPPLIER LOGIC
// ==============================================================================================================

// ==============================================================================================================
// START: PAY SUPPLIER USING STRIPE PAYMENTS/CONNECT LOGIC
// ==============================================================================================================
async function hasStripePayment(dbFulfillmentId: string, client: PoolClient) {
    try {
        const query = `
          SELECT * FROM "Payment"
          WHERE "fulfillmentId" = $1
          LIMIT 1
        `;
        const res = await client.query(query, [dbFulfillmentId]);
        return res.rows.length > 0;
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to check if fulfillment id ${dbFulfillmentId} has stripe payment.`);
    }
}

async function getStripeAccountId(supplierId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "stripeAccountId" FROM "StripeConnectAccount"
          WHERE "supplierId" = $1
          LIMIT 1
        `;
        const res = await client.query(query, [supplierId]);
        if (res.rows.length === 0) {
            throw new Error(`No stripe account id exists for supplierId ${supplierId}.`);
        }
        return res.rows[0].stripeAccountId as string;
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to check if supplierId ${supplierId} has stripe account id.`);
    }
}

async function getStripeCustomerId(retailerId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "stripeCustomerId" FROM "StripeCustomerAccount"
          WHERE "retailerId" = $1
          LIMIT 1
      `;
        const res = await client.query(query, [retailerId]);
        if (res.rows.length === 0) {
            throw new Error(`No stripe customer id id exists for retailerId ${retailerId}.`);
        }
        return res.rows[0].stripeCustomerId as string;
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to get customer id from retailer id ${retailerId}.`);
    }
}

// not sure if customerId is considered PII, but it's also irrelevant w/out api key
async function getStripePaymentMethod(customerId: string) {
    try {
        const stripe = await getStripe();
        const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: 'card',
        });
        if (paymentMethods.data.length === 0) {
            throw new Error(`No payment methods exist for customer ${customerId}`);
        }
        return paymentMethods.data[0].id;
    } catch (error) {
        console.error('error');
        throw new Error(`Failed to get stripe payment method from customer id ${customerId}`);
    }
}

async function paySupplierStripe(supplierId: string, retailerId: string, payableAmount: number, client: PoolClient) {
    try {
        const [supplierStripeAccountId, retailerStripeCustomerId] = await Promise.all([
            getStripeAccountId(supplierId, client),
            getStripeCustomerId(retailerId, client),
        ]);
        const stripe = await getStripe();
        const paymentMethod = await getStripePaymentMethod(retailerStripeCustomerId);
        // https://docs.stripe.com/api/payment_intents/create
        const event = await stripe.paymentIntents.create({
            amount: payableAmount,
            currency: 'usd', // TODO: change currency
            off_session: true,
            confirm: true,
            customer: retailerStripeCustomerId,
            payment_method: paymentMethod,
            transfer_data: {
                destination: supplierStripeAccountId,
            },
        });
        return event.id;
    } catch (error) {
        console.log(error);
        throw new Error(`Failed to pay supplier ${supplierId} from retailer ${retailerId}'s stripe account.`);
    }
}

// ==============================================================================================================
// END: PAY SUPPLIER FOR DELIVERED ORDER LOGIC
// ==============================================================================================================

// ==============================================================================================================
// START: STORE PAYMENT IN DATABASE LOGIC
// ==============================================================================================================
async function createPaymentInDatabase(
    stripeEventId: string,
    orderPaid: number,
    shippingPaid: number,
    dbFulfillmentId: string,
    dbOrderId: string,
    client: PoolClient,
) {
    try {
        const insertionQuery = `
          INSERT INTO "Payment" (
              "id",
              "orderId",
              "stripeEventId",
              "status",
              "orderPaid",
              "shippingPaid",
              "totalPaid",
              "fulfillmentId",
          )
          VALUES (
              $1,  -- id
              $2,  -- orderId
              $3,  -- stripeEventId
              $4,  -- status
              $5,  -- orderPaid
              $6,  -- shippingPaid
              $7,  -- totalPaid
              $8, -- fulfillmentId
          )
        `;
        const totalPaid = orderPaid + shippingPaid;
        await client.query(insertionQuery, [
            uuid(),
            dbOrderId,
            stripeEventId,
            PAYMENT_STATUS.INITIATED,
            orderPaid,
            shippingPaid,
            totalPaid,
            dbFulfillmentId,
        ]);
    } catch (error) {
        console.error(error);
        throw new Error('Failed to add payment to database.');
    }
}

// ==============================================================================================================
// END: STORE PAYMENT IN DATABASE LOGIC
// ==============================================================================================================

// ==============================================================================================================
// START: HELPER FUNCTIONS TO GET DB HELPER FIELDS
// ==============================================================================================================
async function getRetailerSessionFromFulfillmentId(dbFulfillmentId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "Session".* FROM "Fulfillment"
          INNER JOIN "Order" ON "Order"."id" = "Fulfillment"."orderId"
          INNER JOIN "Session" ON "Session"."id" = "Order"."retailerId"
          WHERE "Fulfillment"."id" = $1
          LIMIT 1
        `;
        const res = await client.query(query, [dbFulfillmentId]);
        if (res.rows.length === 0) {
            throw new Error(`No retailer session exists for dbFulfillmentId ${dbFulfillmentId}.`);
        }
        return res.rows[0] as Session;
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to get retailer session from ${dbFulfillmentId} dbFulfillmentId.`);
    }
}

// ==============================================================================================================
// END: HELPER FUNCTIONS TO GET DB HELPER FIELDS
// ==============================================================================================================

async function paySupplierForDeliveredOrder(
    supplierShop: string,
    shopifySupplierOrderId: string,
    supplierShopifyFulfillmentId: string, // TODO: Not urgent: change db to match single format, either shopify or supplier as prefix
    supplierPayload: Payload,
    client: PoolClient,
) {
    const [dbFulfillmentId, supplierSession] = await Promise.all([
        getDbFulfillmentIdFromSupplier(supplierShopifyFulfillmentId, client),
        getSessionFromShop(supplierShop, client),
    ]);
    const orderDetails = await getDbOrderDetails(shopifySupplierOrderId, client);

    const retailerSession = await getRetailerSessionFromFulfillmentId(dbFulfillmentId, client);
    const orderLineItems: SupplierOrderLineItem[] = supplierPayload.line_items.map((lineItem) => {
        return {
            shopifySupplierOrderLineItemId: lineItem.admin_graphql_api_id,
            quantityFulfilled: lineItem.quantity,
        };
    });
    const fulfillmentHasBeenPaid = await hasStripePayment(dbFulfillmentId, client);
    if (fulfillmentHasBeenPaid) {
        console.log(`Fulfillment ${supplierShopifyFulfillmentId} has already been paid`);
        return;
    }
    const { shippingPayableAmount, orderPayableAmount } = await getPayableAmounts(orderDetails, orderLineItems, client);
    const totalPayableAmount = shippingPayableAmount + orderPayableAmount;
    const stripeEventId = await paySupplierStripe(supplierSession.id, retailerSession.id, totalPayableAmount, client);
    await createPaymentInDatabase(
        stripeEventId,
        orderPayableAmount,
        shippingPayableAmount,
        dbFulfillmentId,
        orderDetails.id,
        client,
    );
}

export default paySupplierForDeliveredOrder;
