import { APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { initializePool } from './db';
import { ROLES, RolesProps, ShopifyEvent } from './types';
import { cancelRetailerFulfillment, resyncRetailerFulfillment } from './helper';

// This function listens to when the fulfillment status ever updates
// Few cases:
// retailer can cancel the fulfillment, meaning we have to read the supplier's information and keep products in sync
// supplier can cancel the fulfillment, then it would have to be broadcasted to the retailer and cancel the fulfillment there
// I believe this webhook also handles when the order is marked as delivered (if that's the case, then the supplier needs to be paid)

// checks whether or not we need to process the order and cancel the retailers' fulfillment order
// NOTE: when it's a supplier order, fulfillments/update webhook is re-triggered for the retailer fulfillment
// but it shouldn't trigger webhooks because the fulfillment order should be deleted from the database
async function isProcessableFulfillment(shopifyFulfillmentId: string, role: RolesProps, client: PoolClient) {
    try {
        let query = '';
        if (role === ROLES.RETAILER) {
            query = `SELECT "id" FROM "Fulfillment" WHERE "retailerShopifyFulfillmentId" = $1`;
        } else if (role === ROLES.SUPPLIER) {
            query = `SELECT "id" FROM "Fulfillment" WHERE "supplierShopifyFulfillmentId" = $1`;
        }
        const res = await client.query(query, [shopifyFulfillmentId]);
        return res.rows.length > 0;
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to check whether or not order ${shopifyFulfillmentId} needs to be processed`);
    }
}

function getRelevantDetailsForResyncingRetailerFulfillment(payload: ShopifyEvent['detail']['payload']) {
    const lineItems = payload.line_items.map((lineItem) => ({
        id: lineItem.admin_graphql_api_id,
        quantity: lineItem.quantity,
    }));
    const trackingInfo = {
        company: payload.tracking_company,
        numbers: payload.tracking_numbers,
        urls: payload.tracking_urls,
    };

    return { lineItems, trackingInfo };
}

export const lambdaHandler = async (event: ShopifyEvent): Promise<APIGatewayProxyResult> => {
    let client: null | PoolClient = null;
    try {
        const pool = initializePool();
        client = await pool.connect();
        const payload = event.detail.payload;
        const shop = event.detail.metadata['X-Shopify-Shop-Domain'];
        const fulfillmentUpdateStatus = payload.status;
        const shopifyFulfillmentId = payload.admin_graphql_api_id;
        // TODO: there's one more important edge case, where the retailer just updates the fulfillment without it being a fulfillment in our db
        // I'll handle this edge case after deployment if it's an issue
        const [isRetailerFulfillment, isSupplierFulfillment] = await Promise.all([
            isProcessableFulfillment(shopifyFulfillmentId, ROLES.RETAILER, client),
            isProcessableFulfillment(shopifyFulfillmentId, ROLES.SUPPLIER, client),
        ]);
        if (!isRetailerFulfillment && !isSupplierFulfillment) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Fulfillment update is not related to Synqsell fulfillment.',
                }),
            };
        }
        const { lineItems, trackingInfo } = getRelevantDetailsForResyncingRetailerFulfillment(payload);

        switch (fulfillmentUpdateStatus) {
            case 'cancelled':
                if (isRetailerFulfillment) {
                    await cancelRetailerFulfillment(shopifyFulfillmentId, client);
                } else if (isSupplierFulfillment) {
                    await resyncRetailerFulfillment(shopifyFulfillmentId, shop, lineItems, trackingInfo, client);
                }
                break;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully handled fulfillments update procedure.',
            }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Could not delete products.',
                error: (error as Error).message,
            }),
        };
    } finally {
        if (client) {
            client.release();
        }
    }
};
