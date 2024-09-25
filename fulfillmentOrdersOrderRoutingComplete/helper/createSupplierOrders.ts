import { PoolClient } from 'pg';
import { CustomerShippingDetails, FulfillmentOrdersBySupplier, Session } from '../types';
import createMapIdToRestObj from '../util/createMapToRestObj';
import { mutateAndValidateGraphQLData } from '../util';
import { DRAFT_ORDER_COMPLETE_MUTATION, DRAFT_ORDER_CREATE_MUTATION } from '../graphql';
import { DraftOrderCompleteMutation, DraftOrderCreateMutation } from '../types/admin.generated';
import { ORDER_PAYMENT_STATUS } from '../constants';

type VariantAndImportedVariant = {
    retailerShopifyVariantId: string;
    supplierShopifyVariantId: string;
};

async function getSession(sessionId: string, client: PoolClient) {
    try {
        const sessionQuery = `SELECT * FROM "Session" WHERE "id" = $1`;
        const res = await client.query(sessionQuery, [sessionId]);
        const session: Session = res.rows[0];
        return session;
    } catch (error) {
        throw new Error('Failed to get session ' + sessionId);
    }
}

async function getRetailerToSupplierVariantIdMap(retailerVariantIds: string[], client: PoolClient) {
    const supplierAndRetailerVariantIdsQuery = `
      SELECT 
          "ImportedVariant"."shopifyVariantId" as "retailerShopifyVariantId",
          "Variant"."shopifyVariantId" as "supplierShopifyVariantId"
      FROM "ImportedVariant"
      INNER JOIN "Variant" ON "ImportedVariant"."prismaVariantId" = "Variant"."id"
      WHERE "ImportedVariant"."shopifyVariantId" = ANY($1)  
    `;
    const baseAndImportedVariantData: VariantAndImportedVariant[] = (
        await client.query(supplierAndRetailerVariantIdsQuery, [retailerVariantIds])
    ).rows;

    const retailerToSupplierVariantIdMap = createMapIdToRestObj(baseAndImportedVariantData, 'retailerShopifyVariantId');
    return retailerToSupplierVariantIdMap;
}

// TODO: fill out https://docs.google.com/forms/d/e/1FAIpQLScmVTZRQNjOJ7RD738mL1lGeFjqKVe_FM2tO9xsm21QEo5Ozg/viewform to get sales channel priv
async function createDraftOrder(
    fulfillmentOrder: FulfillmentOrdersBySupplier,
    customerShippingDetails: CustomerShippingDetails,
    supplierSession: Session,
    client: PoolClient,
) {
    const { orderLineItems } = fulfillmentOrder;
    const { email, province: provinceCode, ...restOfCustomerShippingDetails } = customerShippingDetails;
    const retailerVariantIds = fulfillmentOrder.orderLineItems.map((lineItem) => lineItem.shopifyVariantId);
    const retailerToSupplierVariantIdMap = await getRetailerToSupplierVariantIdMap(retailerVariantIds, client);

    //!!! TODO: add shippingLine to draftOrdersInput
    const draftOrdersInput = {
        email,
        lineItems: orderLineItems.map((lineItem) => ({
            variantId: retailerToSupplierVariantIdMap.get(lineItem.shopifyVariantId)?.supplierShopifyVariantId,
            quantity: lineItem.quantity,
        })),
        shippingAddress: {
            ...restOfCustomerShippingDetails,
            provinceCode,
        },
        tags: 'Synqsell',
    };

    // TODO: you are not able to get the line item id from draft order...
    const newDraftOrder = await mutateAndValidateGraphQLData<DraftOrderCreateMutation>(
        supplierSession.shop,
        supplierSession.accessToken,
        DRAFT_ORDER_CREATE_MUTATION,
        {
            input: draftOrdersInput,
        },
        'Failed to create draft order',
    );

    const newDraftOrderId = newDraftOrder.draftOrderCreate?.draftOrder?.id;
    if (!newDraftOrderId) {
        throw new Error('No draft order was created.');
    }
    return newDraftOrderId;
}

async function completeDraftOrder(draftOrderId: string, supplierSession: Session) {
    // TODO: add sourceName to draft order
    const newOrder = await mutateAndValidateGraphQLData<DraftOrderCompleteMutation>(
        supplierSession.shop,
        supplierSession.accessToken,
        DRAFT_ORDER_COMPLETE_MUTATION,
        {
            id: draftOrderId,
        },
        'Failed to create order from draft order',
    );
    const shopifyOrderId = newOrder.draftOrderComplete?.draftOrder?.order?.id;
    if (!shopifyOrderId) {
        throw new Error('No new order was created from draft order.');
    }
    return shopifyOrderId;
}

async function getOrderDetails(shopifyOrderId: string, supplierSession: Session) {}

async function addOrderToDatabase(
    fulfillmentOrder: FulfillmentOrdersBySupplier,
    supplierOrderId: string,
    retailerSession: Session,
    supplierSession: Session,
    client: PoolClient,
) {
    try {
        // TODO: Add currency and shipping cost
        const orderQuery = `
          INSERT INTO 
          "Order" ("currency", "shopifyRetailerFulfillmentOrderId", "shopifySupplierOrderId", "retailerId", "supplierId", "shippingCost", "paymentStatus")
          VALUES($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `;

        const orderLineItemQuery = `
            INSERT INTO "OrderLineItem" (
              "retailerShopifyVariantId",
              "supplierShopifyVariantId",
              "retailPricePerUnit",
              "amountPayablePerUnit",
              "shopifyRetailerOrderLineItemId",
              "shopifySupplierOrderLineItemId",
              "quantity",
              "orderId",
              "priceListId"
            )
            VALUES (
              $1,  -- retailerShopifyVariantId
              $2,  -- supplierShopifyVariantId
              $3,  -- retailPricePerUnit
              $4,  -- amountPayablePerUnit
              $5,  -- shopifyRetailerOrderLineItemId
              $6,  -- shopifySupplierOrderLineItemId
              $7,  -- quantity
              $8, -- orderId
              $9  -- priceListId
            )
        `;

        const newOrder = await client.query(orderQuery, [
            'USD',
            fulfillmentOrder.fulfillmentOrderId,
            supplierOrderId,
            retailerSession.id,
            supplierSession.id,
            0,
            ORDER_PAYMENT_STATUS.INCOMPLETE,
        ]);
        const newDbOrderId: string = newOrder.rows[0].id;
        const lineItems = fulfillmentOrder.orderLineItems;
        const retailerShopifyVariantIds = lineItems.map(({ shopifyVariantId }) => shopifyVariantId);
        // need to find the price list id somehow
    } catch {
        throw new Error('Failed to add newly created order and order line items to database.');
    }
}

async function createSupplierOrder(
    fulfillmentOrder: FulfillmentOrdersBySupplier,
    retailerSession: Session,
    customerShippingDetails: CustomerShippingDetails,
    client: PoolClient,
) {
    const supplierSession = await getSession(fulfillmentOrder.supplierId, client);
    const draftOrderId = await createDraftOrder(fulfillmentOrder, customerShippingDetails, supplierSession, client);
    const orderId = await completeDraftOrder(draftOrderId, supplierSession);
}

// creates the equivalent order for the supplier
async function createSupplierOrders(
    fulfillmentOrdersBySupplier: FulfillmentOrdersBySupplier[],
    retailerSession: Session,
    customerShippingDetails: CustomerShippingDetails,
    client: PoolClient,
) {
    const newOrdersData = await Promise.all(
        fulfillmentOrdersBySupplier.map((order) =>
            createSupplierOrder(order, retailerSession, customerShippingDetails, client),
        ),
    );
}

export default createSupplierOrders;
