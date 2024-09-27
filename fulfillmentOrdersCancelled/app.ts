import { APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { initializePool } from './db';
import { Session, ShopifyEvent } from './types';
import { ORDER_PAYMENT_STATUS } from './constants';
import { cancelSupplierOrder } from './helper';

// orders can only be cancelled on shopify if the order is complete
// eventually you should forcibly sync the supplier shipping status with the retailer so the retailer cannot unfulfil the item if it's been shipped
async function getSession(shop: string, client: PoolClient) {
    const sessionQuery = `SELECT * FROM "Session" WHERE shop = $1 LIMIT 1`;
    const sessionData = await client.query(sessionQuery, [shop]);
    if (sessionData.rows.length === 0) {
        throw new Error('Shop data is invalid.');
    }
    const session = sessionData.rows[0];
    return session as Session;
}

async function isProcessableOrder(shopifyRetailerFulfillmentOrderId: string, retailerId: string, client: PoolClient) {
    try {
        const orderQuery = `
            SELECT "paymentStatus" FROM "Order"
            WHERE "retailerId" = $1 AND "shopifyRetailerFulfillmentOrderId" = $2
            LIMIT 1
        `;
        const orderData = await client.query(orderQuery, [retailerId, shopifyRetailerFulfillmentOrderId]);
        if (orderData.rows.length === 0) {
            return false;
        }
        // Must check payment status to see whether the order was already cancelled to prevent infinite webhook triggering
        const paymentStatus = orderData.rows[0].paymentStatus as string;
        return paymentStatus !== ORDER_PAYMENT_STATUS.CANCELLED;
    } catch (error) {
        console.error(error);
        throw new Error(
            `Failed to check whether or not order ${shopifyRetailerFulfillmentOrderId} needs to be processed`,
        );
    }
}

export const lambdaHandler = async (event: ShopifyEvent): Promise<APIGatewayProxyResult> => {
    let client: null | PoolClient = null;
    try {
        const pool = initializePool();
        client = await pool.connect();
        const shop = event.detail.metadata['X-Shopify-Shop-Domain'];
        const shopifyFulfillmentOrderId = event.detail.payload.fulfillment_order.id;
        const retailerSession = await getSession(shop, client);
        const isRelevantOrder = await isProcessableOrder(shopifyFulfillmentOrderId, retailerSession.id, client);
        if (!isRelevantOrder) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Equivalent supplier order does not need to be cancelled.',
                }),
            };
        }
        await cancelSupplierOrder(shopifyFulfillmentOrderId, client);

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
