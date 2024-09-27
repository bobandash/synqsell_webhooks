// for cancelling retailer order, are there any edge cases I really need to handle?
// supplier wants to be paid no matter what, so it should just broadcast the cancellation to the retailer's store and change payment status to cancelled
// depending on user feedback, we can change impl

import { PoolClient } from 'pg';
import { fetchAndValidateGraphQLData, mutateAndValidateGraphQLData } from '../util';
import { FulfillmentOrderQuery, MMutation } from '../types/admin.generated';
import { LineItemDetail, Session } from '../types';
import { CREATE_REFUND_MUTATION, GET_ORDER_ID } from '../graphql';
import createMapIdToRestObj from '../util/createMapToRestObj';

type SupplierAndRetailerShopifyLineItems = {
    shopifyRetailerOrderLineItemId: string;
    shopifySupplierOrderLineItemId: string;
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

async function getRetailerLineItems(
    supplierLineItems: LineItemDetail[],
    client: PoolClient,
): Promise<LineItemDetail[]> {
    try {
        const supplierShopifyLineItemIds = supplierLineItems.map(({ shopifyLineItemId }) => shopifyLineItemId);
        const query = `
            SELECT "shopifyRetailerOrderLineItemId", "shopifySupplierOrderLineItemId"
            FROM "OrderLineItem"
            WHERE "shopifySupplierOrderLineItemId" = ANY($1)
        `;
        const data = await client.query(query, [supplierShopifyLineItemIds]);
        const supplierAndRetailerShopifyLineItems: SupplierAndRetailerShopifyLineItems[] = data.rows;
        const supplierToRetailerShopifyLineItemsMap = createMapIdToRestObj(
            supplierAndRetailerShopifyLineItems,
            'shopifySupplierOrderLineItemId',
        );

        const retailerLineItems: LineItemDetail[] = supplierLineItems.map((lineItem) => {
            const shopifySupplierLineItemId = lineItem.shopifyLineItemId;
            const retailerLineItemId =
                supplierToRetailerShopifyLineItemsMap.get(shopifySupplierLineItemId)?.shopifyRetailerOrderLineItemId;
            if (!retailerLineItemId) {
                throw new Error('No retailer line item matches supplier line item ' + lineItem.shopifyLineItemId);
            }
            return {
                shopifyLineItemId: retailerLineItemId,
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
    retailerLineItems: LineItemDetail[],
    retailerSession: Session,
) {
    const input = {
        orderId: shopifyRetailerOrderId,
        refundLineItems: retailerLineItems.map((lineItem) => {
            return {
                lineItemId: lineItem.shopifyLineItemId,
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
    retailerLineItems: LineItemDetail[],
    client: PoolClient,
) {
    try {
        const updateQuery = `UPDATE "OrderLineItem" SET "quantityCancelled" = $1 WHERE "shopifyRetailerOrderLineItemId" = $2`;
        const updateOrderLineItemPromises = retailerLineItems.map((lineItem) =>
            client.query(updateQuery, [lineItem.quantity, lineItem.shopifyLineItemId]),
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
    const retailerLineItems = await getRetailerLineItems(supplierLineItems, client);
    await refundRetailerOrderOnShopify(shopifyRetailerOrderId, retailerLineItems, retailerSession);
    await updateOrderLineItemsQuantityCancelled(dbOrderId, retailerLineItems, client);
}

export default refundRetailerOrder;
