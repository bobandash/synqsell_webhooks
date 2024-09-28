// for cancelling retailer order, are there any edge cases I really need to handle?
// supplier wants to be paid no matter what, so it should just broadcast the cancellation to the retailer's store and change payment status to cancelled
// depending on user feedback, we can change impl

import { PoolClient } from 'pg';
import { fetchAndValidateGraphQLData, mutateAndValidateGraphQLData } from '../util';
import {
    FulfillmentOrderQuery,
    MMutation,
    OrderLineItemsQuery,
    SubsequentOrderLineItemsQuery,
} from '../types/admin.generated';
import { LineItemDetail, RetailerLineItemDetail, Session } from '../types';
import {
    CREATE_REFUND_MUTATION,
    GET_ORDER_ID,
    GET_ORDER_LINE_ITEMS,
    GET_SUBSEQUENT_ORDER_LINE_ITEMS,
} from '../graphql';
import createMapIdToRestObj from '../util/createMapToRestObj';

type DbOrderLineItemDetails = {
    retailerShopifyVariantId: string;
    shopifySupplierOrderLineItemId: string;
    shopifyRetailerOrderLineItemId: string;
};

type ShopifyRetailerOrderLineWithRetailerVariantId = {
    retailerOrderLineItemId: string;
    retailerShopifyVariantId: string;
};

// ==============================================================================================================
// START: CANCEL FULFILLMENT ORDER ON RETAILER'S STORE LOGIC
// ==============================================================================================================

async function getOrderIdFromDatabase(supplierShopifyOrderId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "id" FROM "Order"
          WHERE "shopifySupplierOrderId" = $1
          LIMIT 1
        `;
        const queryRes = await client.query(query, [supplierShopifyOrderId]);
        if (queryRes.rows.length === 0) {
            throw new Error('No order exists for shopifySupplierOrderId ' + supplierShopifyOrderId);
        }

        return queryRes.rows[0].id as string;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to database order id for shopifySupplierOrderId ' + supplierShopifyOrderId);
    }
}

async function getRetailerShopifyFulfillmentOrderId(supplierShopifyOrderId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "shopifyRetailerFulfillmentOrderId" FROM "Order"
          WHERE "shopifySupplierOrderId" = $1
          LIMIT 1
        `;
        const queryRes = await client.query(query, [supplierShopifyOrderId]);
        if (queryRes.rows.length === 0) {
            throw new Error(
                'No shopifyRetailerFulfillmentOrderId exists for shopifySupplierOrderId ' + supplierShopifyOrderId,
            );
        }

        return queryRes.rows[0].shopifyRetailerFulfillmentOrderId as string;
    } catch (error) {
        console.error(error);
        throw new Error(
            'Failed to get shopifyRetailerFulfillmentOrderId from shopifySupplierOrderId ' + supplierShopifyOrderId,
        );
    }
}

async function getRetailerSession(shopifyFulfillmentOrderId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "Session".* FROM "Order"
          INNER JOIN "Session" ON "Order"."retailerId" = "Session"."id"
          WHERE "Order"."shopifyRetailerFulfillmentOrderId" = $1
          LIMIT 1
        `;
        const queryRes = await client.query(query, [shopifyFulfillmentOrderId]);
        if (queryRes.rows.length === 0) {
            throw new Error('No retailer session exists for shopifyFulfillmentOrderId ' + shopifyFulfillmentOrderId);
        }

        return queryRes.rows[0] as Session;
    } catch (error) {
        console.error(error);
        throw new Error(
            'Failed to retrieve retailer session from shopifyFulfillmentOrderId ' + shopifyFulfillmentOrderId,
        );
    }
}

async function getRetailerShopifyOrderId(shopifyFulfillmentId: string, retailerSession: Session) {
    const data = await fetchAndValidateGraphQLData<FulfillmentOrderQuery>(
        retailerSession.shop,
        retailerSession.accessToken,
        GET_ORDER_ID,
        {
            id: shopifyFulfillmentId,
        },
    );
    const shopifyRetailerOrderId = data.fulfillmentOrder?.orderId ?? '';
    return shopifyRetailerOrderId;
}

// TODO: I wonder if I can create a generic function for this in the future
async function getAllRetailerOrderLineItemIdWithVariantId(retailerShopifyOrderId: string, retailerSession: Session) {
    const orderLineItemsWithVariantId: ShopifyRetailerOrderLineWithRetailerVariantId[] = [];
    const initialOrderLines = await fetchAndValidateGraphQLData<OrderLineItemsQuery>(
        retailerSession.shop,
        retailerSession.accessToken,
        GET_ORDER_LINE_ITEMS,
        {
            id: retailerShopifyOrderId,
        },
    );
    const initialPageInfo = initialOrderLines.order?.lineItems.pageInfo;
    const initialData = initialOrderLines.order?.lineItems.edges;
    initialData?.forEach(({ node }) => {
        orderLineItemsWithVariantId.push({
            retailerOrderLineItemId: node.id,
            retailerShopifyVariantId: node.variant?.id ?? '',
        });
    });

    let hasMore = initialPageInfo?.hasNextPage ?? false;
    let endCursor = initialPageInfo?.endCursor ?? null;

    while (hasMore && endCursor) {
        const subsequentOrderLines = await fetchAndValidateGraphQLData<SubsequentOrderLineItemsQuery>(
            retailerSession.shop,
            retailerSession.accessToken,
            GET_SUBSEQUENT_ORDER_LINE_ITEMS,
            {
                id: retailerShopifyOrderId,
                after: endCursor,
            },
        );
        const subsequentPageInfo = subsequentOrderLines.order?.lineItems.pageInfo;
        const subsequentData = subsequentOrderLines.order?.lineItems.edges;
        subsequentData?.forEach(({ node }) => {
            orderLineItemsWithVariantId.push({
                retailerOrderLineItemId: node.id,
                retailerShopifyVariantId: node.variant?.id ?? '',
            });
        });
        hasMore = subsequentPageInfo?.hasNextPage ?? false;
        endCursor = subsequentPageInfo?.endCursor ?? null;
    }

    return orderLineItemsWithVariantId;
}

async function getRetailerOrderLineItems(
    supplierLineItems: LineItemDetail[],
    shopifyRetailerOrderId: string,
    retailerSession: Session,
    client: PoolClient,
): Promise<RetailerLineItemDetail[]> {
    try {
        // NOTE: shopify supplier line item = orderLineItem while retailer line item = fulfillmentOrderLineItem in database
        // shopify currently does not have a method of querying the orderLineItemId from the fulfillmentOrderLineItemId,
        // so the simplest way to do it is by matching the order line item id with the variants
        const supplierShopifyLineItemIds = supplierLineItems.map(({ shopifyLineItemId }) => shopifyLineItemId);
        const query = `
            SELECT "retailerShopifyVariantId", "shopifySupplierOrderLineItemId", "shopifyRetailerOrderLineItemId"
            FROM "OrderLineItem"
            WHERE "shopifySupplierOrderLineItemId" = ANY($1)
        `;
        const [queryRes, retailerOrderLineItemsWithVariantId] = await Promise.all([
            client.query(query, [supplierShopifyLineItemIds]),
            getAllRetailerOrderLineItemIdWithVariantId(shopifyRetailerOrderId, retailerSession),
        ]);
        const dbLineItemDetails: DbOrderLineItemDetails[] = queryRes.rows;
        const supplierOrderLineItemIdToRestMap = createMapIdToRestObj(
            dbLineItemDetails,
            'shopifySupplierOrderLineItemId',
        );
        const retailerVariantIdToRetailerOrderLineIdMap = createMapIdToRestObj(
            retailerOrderLineItemsWithVariantId,
            'retailerShopifyVariantId',
        );

        const retailerLineItems: RetailerLineItemDetail[] = supplierLineItems.map((lineItem) => {
            const shopifySupplierLineItemId = lineItem.shopifyLineItemId;
            const {
                retailerShopifyVariantId,
                shopifyRetailerOrderLineItemId: shopifyRetailerFulfillmentOrderLineItemId,
            } = supplierOrderLineItemIdToRestMap.get(shopifySupplierLineItemId) ?? {
                retailerShopifyVariantId: undefined,
                shopifyRetailerOrderLineItemId: undefined,
            };

            if (!retailerShopifyVariantId || !shopifyRetailerFulfillmentOrderLineItemId) {
                throw new Error(`Supplier line item ${lineItem.shopifyLineItemId} was not in the database.`);
            }
            const retailerOrderLineId =
                retailerVariantIdToRetailerOrderLineIdMap.get(retailerShopifyVariantId)?.retailerOrderLineItemId;

            if (!retailerOrderLineId) {
                throw new Error(`No order line id matches ${retailerShopifyVariantId} in shopify`);
            }
            return {
                shopifyFulfillmentLineItemId: shopifyRetailerFulfillmentOrderLineItemId,
                shopifyOrderLineItemId: retailerOrderLineId,
                quantity: lineItem.quantity,
            };
        });
        return retailerLineItems;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to get retailer line items.');
    }
}

async function refundRetailerOrderOnShopify(
    shopifyRetailerOrderId: string,
    retailerLineItems: RetailerLineItemDetail[],
    retailerSession: Session,
) {
    const input = {
        orderId: shopifyRetailerOrderId,
        refundLineItems: retailerLineItems.map((lineItem) => {
            return {
                lineItemId: lineItem.shopifyOrderLineItemId,
                quantity: lineItem.quantity,
            };
        }),
        notify: true,
    };

    console.log(input);

    await mutateAndValidateGraphQLData<MMutation>(
        retailerSession.shop,
        retailerSession.accessToken,
        CREATE_REFUND_MUTATION,
        {
            input,
        },
        `Failed to refund retailer's order ${shopifyRetailerOrderId}`,
    );
}

async function updateOrderLineItemsQuantityCancelled(
    dbOrderId: string,
    retailerLineItems: RetailerLineItemDetail[],
    client: PoolClient,
) {
    try {
        const updateQuery = `UPDATE "OrderLineItem" SET "quantityCancelled" = $1 WHERE "shopifyRetailerOrderLineItemId" = $2`;
        const updateOrderLineItemPromises = retailerLineItems.map((lineItem) =>
            client.query(updateQuery, [lineItem.quantity, lineItem.shopifyFulfillmentLineItemId]),
        );
        await Promise.all(updateOrderLineItemPromises);
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to update order ${dbOrderId} to cancelled.`);
    }
}

// ==============================================================================================================
// END: CANCEL FULFILLMENT ORDER ON RETAILER'S STORE LOGIC
// ==============================================================================================================

// NOTE: The implementation has to be as such:
// shopify does not allow partial cancellations, and the logic is that
// retailer has one or more fulfillment orders, while a supplier has one order
// so, w/out the permission to cancel the fulfillment order partially, we just refund the line items that the supplier cancelled
async function refundRetailerOrder(
    supplierShopifyOrderId: string,
    supplierLineItems: LineItemDetail[],
    client: PoolClient,
) {
    const dbOrderId = await getOrderIdFromDatabase(supplierShopifyOrderId, client);
    const shopifyRetailerFulfillmentOrderId = await getRetailerShopifyFulfillmentOrderId(
        supplierShopifyOrderId,
        client,
    );
    const retailerSession = await getRetailerSession(shopifyRetailerFulfillmentOrderId, client);
    const shopifyRetailerOrderId = await getRetailerShopifyOrderId(shopifyRetailerFulfillmentOrderId, retailerSession);
    const retailerLineItems = await getRetailerOrderLineItems(
        supplierLineItems,
        shopifyRetailerOrderId,
        retailerSession,
        client,
    );
    await refundRetailerOrderOnShopify(shopifyRetailerOrderId, retailerLineItems, retailerSession);
    await updateOrderLineItemsQuantityCancelled(dbOrderId, retailerLineItems, client);
}

export default refundRetailerOrder;
