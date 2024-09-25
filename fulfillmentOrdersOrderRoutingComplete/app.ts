import { APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { initializePool } from './db';
import { ShopifyEvent } from './types';
import { fetchAndValidateGraphQLData } from './util';
import { GET_FULFILLMENT_ORDER_LOCATION } from './graphql';
import { FulfillmentOrderLocationQuery } from './types/admin.generated';
import { splitFulfillmentOrderBySupplier } from './helper';

type FulfillmentOrderDetails = {
    fulfillmentOrderId: string;
    orderLineDetails: OrderLineDetail[];
};

async function getSession(shop: string, client: PoolClient) {
    const sessionQuery = `SELECT * FROM "Session" WHERE shop = $1 LIMIT 1`;
    const sessionData = await client.query(sessionQuery, [shop]);
    if (sessionData.rowCount === 0) {
        throw new Error('Shop data is invalid.');
    }
    const session = sessionData.rows[0];
    return session;
}

async function createSupplierOrders(newFulfillmentOrders: Map<string, FulfillmentOrderDetails>) {
    // TODO: now, figure out how you want to handle payments
    return;
}

async function isSynqsellFulfillmentLocation(
    shop: string,
    accessToken: string,
    sessionId: string,
    fulfillmentOrderId: string,
    client: PoolClient,
) {
    const locationQuery = await fetchAndValidateGraphQLData<FulfillmentOrderLocationQuery>(
        shop,
        accessToken,
        GET_FULFILLMENT_ORDER_LOCATION,
        {
            id: fulfillmentOrderId,
        },
    );
    const fulfillmentOrderShopifyLocationId = locationQuery.fulfillmentOrder?.assignedLocation.location?.id ?? '';
    if (!fulfillmentOrderShopifyLocationId) {
        return false;
    }
    const fulfillmentServiceQuery = `
        SELECT id FROM "FulfillmentService" 
        WHERE "shopifyLocationId" = $1 
        AND "sessionId" = $2 
        LIMIT 1
    `;
    const fulfillmentService = await client.query(fulfillmentServiceQuery, [
        fulfillmentOrderShopifyLocationId,
        sessionId,
    ]);
    if (fulfillmentService && fulfillmentService.rows.length > 0) {
        return true;
    }
    return false;
}

// Fulfillment orders are routed by location
// However, there is a case where the same fulfillment orders has different suppliers, and it would have to be split up further
export const lambdaHandler = async (event: ShopifyEvent): Promise<APIGatewayProxyResult> => {
    let client: null | PoolClient = null;
    try {
        const pool = initializePool();
        client = await pool.connect();
        const shop = event.detail['X-Shopify-Shop-Domain'];
        const shopifyFulfillmentOrderId = event.detail.payload.fulfillment_order.id;
        const session = await getSession(shop, client);

        const isSynqsellOrder = await isSynqsellFulfillmentLocation(
            shop,
            session.accessToken,
            session.id,
            shopifyFulfillmentOrderId,
            client,
        );

        if (!isSynqsellOrder) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'This fulfillment order is not a SynqSell order.',
                }),
            };
        }

        const fulfillmentOrdersBySupplier = await splitFulfillmentOrderBySupplier(
            shopifyFulfillmentOrderId,
            shop,
            session.accessToken,
            client,
        );
        // await createSupplierOrders(newFulfillmentOrders);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully created fulfillment orders for supplier.',
            }),
        };
    } catch (err) {
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully created fulfillment orders for supplier.',
            }),
        };
    } finally {
        if (client) {
            client.release();
        }
    }
};
