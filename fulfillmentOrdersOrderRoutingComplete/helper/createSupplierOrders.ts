import { Pool, PoolClient } from 'pg';
import { CustomerShippingDetails, FulfillmentOrdersBySupplier, Session } from '../types';
import { fetchAndValidateGraphQLData, mutateAndValidateGraphQLData } from '../util';
import {
    DRAFT_ORDER_COMPLETE_MUTATION,
    DRAFT_ORDER_CREATE_MUTATION,
    GET_INITIAL_ORDER_DETAILS_DATABASE,
    GET_SUBSEQUENT_ORDER_DETAILS_DATABASE,
} from '../graphql';
import {
    DraftOrderCompleteMutation,
    DraftOrderCreateMutation,
    InitialOrderDetailsQuery,
    SubsequentOrderDetailsQuery,
} from '../types/admin.generated';
import { ORDER_PAYMENT_STATUS } from '../constants';
import { CurrencyCode } from '../types/admin.types';
import { getRetailerToSupplierVariantIdMap, getSession } from './util';
import createMapIdToRestObj from '../util/createMapToRestObj';

type OrderDetailForDatabase = {
    shopifyOrderId: string;
    currency: CurrencyCode | null;
    shippingCost: number;
    lineItems: {
        shopifyLineItemId: string;
        shopifyVariantId: string | null;
        quantity: number;
    }[];
};

type AddOrderLineToDatabase = {
    retailerShopifyVariantId: string;
    supplierShopifyVariantId: string;
    retailPricePerUnit: number;
    amountPayablePerUnit: number;
    shopifyRetailerOrderLineItemId: string;
    shopifySupplierOrderLineItemId: string;
    quantity: number;
    orderId: string;
    priceListId: string;
};

type PriceDetail = {
    retailPrice: string;
    retailerPayment: string;
};

// ==============================================================================================================
// START: ADD EQUIVALENT ORDER FROM FULFILLMENT ORDER ON SUPPLIER'S SHOPIFY STORE LOGIC
// ==============================================================================================================
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
    //!!! TODO: add presentmentCurrencyCode
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

// ==============================================================================================================
// START: ADD ORDERS TO DATABASE LOGIC
// ==============================================================================================================
async function getOrderDetails(shopifyOrderId: string, session: Session) {
    let hasMore = true;
    let endCursor = null;

    const initialOrderDetails = await fetchAndValidateGraphQLData<InitialOrderDetailsQuery>(
        session.shop,
        session.accessToken,
        GET_INITIAL_ORDER_DETAILS_DATABASE,
        {
            id: shopifyOrderId,
        },
    );

    const orderDetails = initialOrderDetails.order;
    const orderDetailsForDatabase: OrderDetailForDatabase = {
        shopifyOrderId: shopifyOrderId,
        currency: orderDetails?.presentmentCurrencyCode ?? null,
        shippingCost: orderDetails?.shippingLine?.originalPriceSet.presentmentMoney.amount ?? 0,
        lineItems:
            orderDetails?.lineItems.edges.map(({ node }) => ({
                shopifyLineItemId: node.id,
                shopifyVariantId: node.variant?.id ?? null, // this will not be null, just graphql semantics
                quantity: node.quantity,
            })) ?? [],
    };

    hasMore = initialOrderDetails.order?.lineItems.pageInfo.hasNextPage ?? false;
    endCursor = initialOrderDetails.order?.lineItems.pageInfo.endCursor ?? null;
    while (hasMore && endCursor) {
        const subsequentOrderLineItemDetails: SubsequentOrderDetailsQuery =
            await fetchAndValidateGraphQLData<SubsequentOrderDetailsQuery>(
                session.shop,
                session.accessToken,
                GET_SUBSEQUENT_ORDER_DETAILS_DATABASE,
                {
                    id: shopifyOrderId,
                    after: endCursor,
                },
            );

        const prevLineItems = orderDetailsForDatabase?.lineItems;
        const newLineItems =
            subsequentOrderLineItemDetails.order?.lineItems.edges.map(({ node }) => ({
                shopifyLineItemId: node.id,
                shopifyVariantId: node.variant?.id ?? null, // this will not be null, just graphql semantics
                quantity: node.quantity,
            })) ?? [];
        const lineItems = [...prevLineItems, ...newLineItems];
        orderDetailsForDatabase.lineItems = lineItems;
        hasMore = subsequentOrderLineItemDetails.order?.lineItems.pageInfo.hasNextPage ?? false;
        endCursor = subsequentOrderLineItemDetails.order?.lineItems.pageInfo.endCursor ?? null;
    }

    return orderDetailsForDatabase;
}

async function addOrderToDatabase(
    shopifyRetailerFulfillmentOrderId: string,
    shopifySupplierOrderId: string,
    retailerSessionId: string,
    supplierSessionId: string,
    client: PoolClient,
) {
    try {
        const orderQuery = `
            INSERT INTO 
            "Order" ("currency", "shopifyRetailerFulfillmentOrderId", "shopifySupplierOrderId", "retailerId", "supplierId", "shippingCost", "paymentStatus")
            VALUES($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `;
        const newOrder = await client.query(orderQuery, [
            'USD',
            shopifyRetailerFulfillmentOrderId,
            shopifySupplierOrderId,
            retailerSessionId,
            supplierSessionId,
            0,
            ORDER_PAYMENT_STATUS.INCOMPLETE,
        ]);

        const newDbOrderId: string = newOrder.rows[0].id;
        return newDbOrderId;
    } catch {
        throw new Error('Failed to add order to database.');
    }
}

async function addOrderLineToDatabase(props: AddOrderLineToDatabase, client: PoolClient) {
    try {
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
        const {
            retailerShopifyVariantId,
            supplierShopifyVariantId,
            retailPricePerUnit,
            amountPayablePerUnit,
            shopifyRetailerOrderLineItemId,
            shopifySupplierOrderLineItemId,
            quantity,
            orderId,
            priceListId,
        } = props;

        await client.query(orderLineItemQuery, [
            retailerShopifyVariantId,
            supplierShopifyVariantId,
            retailPricePerUnit,
            amountPayablePerUnit,
            shopifyRetailerOrderLineItemId,
            shopifySupplierOrderLineItemId,
            quantity,
            orderId,
            priceListId,
        ]);
    } catch {
        throw new Error('Failed to add order line to database.');
    }
}

async function getRetailPriceAndProfit(supplierShopifyVariantId: string, priceListId: string, client: PoolClient) {
    try {
        const query = `
            SELECT 
                "Variant"."retailPrice",
                "Variant"."retailerPayment"
            FROM "Variant"
            INNER JOIN "Product" ON "Product"."id" = "Variant"."productId"
            WHERE
                "Product"."priceListId" = $1 AND
                "Variant"."shopifyVariantId" = $2
            LIMIT 1
        `;
        const queryRes = await client.query(query, [priceListId, supplierShopifyVariantId]);
        if (queryRes.rows.length === 0) {
            throw new Error(
                `Could not get retail price and profit from variant id ${supplierShopifyVariantId} and price list ${priceListId}.`,
            );
        }
        return queryRes.rows[0] as PriceDetail;
    } catch {
        throw new Error(
            `Failed to get retail price and profit from supplier variant id ${supplierShopifyVariantId} and price list id ${priceListId}`,
        );
    }
}

async function addEntireOrderToDatabase(
    fulfillmentOrder: FulfillmentOrdersBySupplier,
    supplierOrderDetails: OrderDetailForDatabase,
    retailerSession: Session,
    supplierSession: Session,
    client: PoolClient,
) {
    const retailerOrderLineItems = fulfillmentOrder.orderLineItems;
    const supplierOrderLineItems = supplierOrderDetails.lineItems;
    const newDbOrderId = await addOrderToDatabase(
        fulfillmentOrder.fulfillmentOrderId,
        supplierOrderDetails.shopifyOrderId,
        retailerSession.id,
        supplierSession.id,
        client,
    );
    const retailerVariantIds = retailerOrderLineItems.map((lineItem) => lineItem.shopifyVariantId);
    const retailerToSupplierVariantIdsMap = await getRetailerToSupplierVariantIdMap(retailerVariantIds, client);
    const supplierOrderLineItemsMap = createMapIdToRestObj(supplierOrderLineItems, 'shopifyVariantId'); // key is supplier variant id

    // gets list of promises with data to add to database
    const createOrderLineItemPromises = retailerOrderLineItems.map(async (retailerLineItem) => {
        const retailerShopifyVariantId = retailerLineItem.shopifyVariantId;
        const supplierShopifyVariantId =
            retailerToSupplierVariantIdsMap.get(retailerShopifyVariantId)?.supplierShopifyVariantId;
        if (!supplierShopifyVariantId) {
            throw new Error(
                `Retailer shopify variant id ${retailerShopifyVariantId} does not match any supplier variant id.`,
            );
        }
        const supplierOrderLineItemDetails = supplierOrderLineItemsMap.get(supplierShopifyVariantId);
        if (!supplierOrderLineItemDetails) {
            throw new Error(`Order line does not exist for supplier shopify variant ${supplierShopifyVariantId}`);
        }
        const prices = await getRetailPriceAndProfit(supplierShopifyVariantId, retailerLineItem.priceListId, client);

        return addOrderLineToDatabase(
            {
                retailerShopifyVariantId: retailerShopifyVariantId,
                supplierShopifyVariantId: supplierShopifyVariantId,
                retailPricePerUnit: Number(prices.retailPrice), // TODO: change database for price and payment
                amountPayablePerUnit: Number(prices.retailerPayment),
                shopifyRetailerOrderLineItemId: retailerLineItem.shopifyLineItemId,
                shopifySupplierOrderLineItemId: supplierOrderLineItemDetails.shopifyLineItemId,
                quantity: retailerLineItem.quantity,
                orderId: newDbOrderId,
                priceListId: retailerLineItem.priceListId,
            },
            client,
        );
    });

    await Promise.all(createOrderLineItemPromises);
}
// ==============================================================================================================
// END: ADD ORDERS TO DATABASE LOGIC
// ==============================================================================================================

async function createSupplierOrder(
    fulfillmentOrder: FulfillmentOrdersBySupplier,
    retailerSession: Session,
    customerShippingDetails: CustomerShippingDetails,
    client: PoolClient,
) {
    const supplierSession = await getSession(fulfillmentOrder.supplierId, client);
    const draftOrderId = await createDraftOrder(fulfillmentOrder, customerShippingDetails, supplierSession, client);
    const supplierShopifyOrderId = await completeDraftOrder(draftOrderId, supplierSession);
    const supplierOrderDetails = await getOrderDetails(supplierShopifyOrderId, supplierSession);
    await addEntireOrderToDatabase(fulfillmentOrder, supplierOrderDetails, retailerSession, supplierSession, client);
}

// creates the
async function createSupplierOrders(
    fulfillmentOrdersBySupplier: FulfillmentOrdersBySupplier[],
    retailerSession: Session,
    customerShippingDetails: CustomerShippingDetails,
    client: PoolClient,
) {
    const createNewOrdersPromises = fulfillmentOrdersBySupplier.map((order) =>
        createSupplierOrder(order, retailerSession, customerShippingDetails, client),
    );
    await Promise.all(createNewOrdersPromises);
}

export default createSupplierOrders;
