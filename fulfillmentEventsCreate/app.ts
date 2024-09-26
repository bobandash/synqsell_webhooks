import { APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { initializePool } from './db';
import { ShopifyEvent } from './types';
import { composeGid } from '@shopify/admin-graphql-api-utilities';
import { updateRetailerFulfillment } from './helper';

async function getSession(shop: string, client: PoolClient) {
    try {
        const sessionQuery = `SELECT * FROM "Session" WHERE shop = $1 LIMIT 1`;
        const sessionData = await client.query(sessionQuery, [shop]);
        if (sessionData.rows.length === 0) {
            throw new Error('Shop data is invalid.');
        }
        const session = sessionData.rows[0];
        return session;
    } catch {
        throw new Error(`Failed to retrieve session from shop ${shop}.`);
    }
}

async function isSynqsellOrder(shopifyOrderId: string, shop: string, client: PoolClient) {
    const session = await getSession(shop, client);
    const orderQuery = `
        SELECT "id" FROM "Order"
        WHERE "supplierId" = $1 AND "shopifySupplierOrderId" = $2
        LIMIT 1
    `;
    const orderData = await client.query(orderQuery, [session.id, shopifyOrderId]);
    return orderData.rows.length > 0;
}

export const lambdaHandler = async (event: ShopifyEvent): Promise<APIGatewayProxyResult> => {
    let client: null | PoolClient = null;
    try {
        const pool = initializePool();
        client = await pool.connect();
        const payload = event.detail.payload;
        const shop = event.detail.metadata['X-Shopify-Shop-Domain'];
        const { order_id: orderId, fulfillment_id: fulfillmentId } = payload;
        const shopifyOrderId = composeGid('Order', orderId);
        const shopifyFulfillmentId = composeGid('Fulfillment', fulfillmentId);

        const isRelevantOrder = await isSynqsellOrder(shopifyOrderId, shop, client);
        if (!isRelevantOrder) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: `${shopifyOrderId} is not a Synqsell order.`,
                }),
            };
        }
        await updateRetailerFulfillment(shopifyFulfillmentId, shopifyOrderId, client);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully synced fulfillment creation event to retailer..',
            }),
        };
    } catch (error) {
        console.error(error);
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
