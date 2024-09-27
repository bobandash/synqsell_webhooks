import { APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { initializePool } from './db';
import { Session, ShopifyEvent } from './types';
import { cancelRetailerOrder } from './helper';

async function getSession(shop: string, client: PoolClient) {
    const sessionQuery = `SELECT * FROM "Session" WHERE shop = $1 LIMIT 1`;
    const sessionData = await client.query(sessionQuery, [shop]);
    if (sessionData.rows.length === 0) {
        throw new Error('Shop data is invalid.');
    }
    const session = sessionData.rows[0];
    return session as Session;
}

async function isSynqsellOrder(shopifyOrderId: string, supplierId: string, client: PoolClient) {
    const orderQuery = `
        SELECT "id" FROM "Order"
        WHERE "supplierId" = $1 AND "shopifySupplierOrderId" = $2
        LIMIT 1
    `;
    const orderData = await client.query(orderQuery, [supplierId, shopifyOrderId]);
    return orderData.rows.length > 0;
}

export const lambdaHandler = async (event: ShopifyEvent): Promise<APIGatewayProxyResult> => {
    let client: null | PoolClient = null;
    try {
        const pool = initializePool();
        client = await pool.connect();
        const shop = event.detail.metadata['X-Shopify-Shop-Domain'];
        const shopifyOrderId = event.detail.payload.admin_graphql_api_id;
        const supplierSession = await getSession(shop, client);
        const isRelevantOrder = await isSynqsellOrder(shopifyOrderId, supplierSession.id, client);

        if (!isRelevantOrder) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Order is not a Synqsell order.',
                }),
            };
        }

        await cancelRetailerOrder(shopifyOrderId, client);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully cancelled order for retailer and updated database.',
            }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Failed to cancel order for retailer and update database.',
                error: (error as Error).message,
            }),
        };
    } finally {
        if (client) {
            client.release();
        }
    }
};
