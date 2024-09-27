import { APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { initializePool } from './db';
import { ORDER_PAYMENT_STATUS, Session, ShopifyEvent } from './types';
import { composeGid } from '@shopify/admin-graphql-api-utilities';
import { cancelRetailerFulfillment } from './helper';

// This function listens to the supplier order and handles the following cases:
// when supplier cancels the tracking to upload a new one
// when tracking status is updates to delivered and pays the retailer

async function getSession(shop: string, client: PoolClient) {
    const sessionQuery = `SELECT * FROM "Session" WHERE shop = $1 LIMIT 1`;
    const sessionData = await client.query(sessionQuery, [shop]);
    if (sessionData.rows.length === 0) {
        throw new Error('Shop data is invalid.');
    }
    const session = sessionData.rows[0];
    return session as Session;
}

// checks whether or not we need to process the order and cancel the retailers' fulfillment order
async function isProcessableOrder(shopifyOrderId: string, supplierId: string, client: PoolClient) {
    try {
        const orderQuery = `
            SELECT "paymentStatus" FROM "Order"
            WHERE "supplierId" = $1 AND "shopifySupplierOrderId" = $2
            LIMIT 1
        `;
        const orderData = await client.query(orderQuery, [supplierId, shopifyOrderId]);
        if (orderData.rows.length === 0) {
            return false;
        }
        // NOTE: because this app subscribes to both the orders/cancelled and fulfillment_orders/cancelled webhooks
        // Must check payment status to see whether the order was already cancelled to prevent infinite webhook triggering
        const paymentStatus = orderData.rows[0].paymentStatus as string;
        return paymentStatus !== ORDER_PAYMENT_STATUS.CANCELLED;
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to check whether or not order ${shopifyOrderId} needs to be processed`);
    }
}

export const lambdaHandler = async (event: ShopifyEvent): Promise<APIGatewayProxyResult> => {
    let client: null | PoolClient = null;
    try {
        const pool = initializePool();
        client = await pool.connect();
        const shop = event.detail.metadata['X-Shopify-Shop-Domain'];
        const payload = event.detail.payload;
        const rawOrderId = payload.order_id;
        const supplierSession = await getSession(shop, client);
        const shopifySupplierOrderId = composeGid('Order', rawOrderId);
        const isRelevantOrder = await isProcessableOrder(shopifySupplierOrderId, supplierSession.id, client);

        if (!isRelevantOrder) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'This is not a Synqsell order that needs to be processed.',
                }),
            };
        }

        const fulfillmentUpdateStatus = payload.status;
        const supplierShopifyFulfillmentId = payload.admin_graphql_api_id;

        switch (fulfillmentUpdateStatus) {
            case 'cancelled':
                await cancelRetailerFulfillment(supplierShopifyFulfillmentId, client);
                break;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully did procedure.',
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
