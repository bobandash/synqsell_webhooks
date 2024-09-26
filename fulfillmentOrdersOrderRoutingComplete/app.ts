import { APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { initializePool } from './db';
import { Session, ShopifyEvent } from './types';
import { fetchAndValidateGraphQLData } from './util';
import { GET_FULFILLMENT_ORDER_CUSTOMER_DETAILS, GET_FULFILLMENT_ORDER_LOCATION } from './graphql';
import { FulfillmentOrderCustomerDetailsQuery, FulfillmentOrderLocationQuery } from './types/admin.generated';
import { createSupplierOrders, splitFulfillmentOrderBySupplier } from './helper';

// sam local invoke FulfillmentOrderRoutingCompleteFunction --event ./fulfillmentOrdersOrderRoutingComplete/app_event.json

async function getSession(shop: string, client: PoolClient) {
    const sessionQuery = `SELECT * FROM "Session" WHERE shop = $1 LIMIT 1`;
    const sessionData = await client.query(sessionQuery, [shop]);
    if (sessionData.rows.length === 0) {
        throw new Error('Shop data is invalid.');
    }
    const session = sessionData.rows[0];
    return session;
}

async function isSynqsellFulfillmentLocation(retailerSession: Session, fulfillmentOrderId: string, client: PoolClient) {
    const locationQuery = await fetchAndValidateGraphQLData<FulfillmentOrderLocationQuery>(
        retailerSession.shop,
        retailerSession.accessToken,
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
        retailerSession.id,
    ]);
    if (fulfillmentService && fulfillmentService.rows.length > 0) {
        return true;
    }
    return false;
}

async function getCustomerShippingDetails(fulfillmentOrderId: string, retailerSession: Session) {
    const fulfillmentOrderQuery = await fetchAndValidateGraphQLData<FulfillmentOrderCustomerDetailsQuery>(
        retailerSession.shop,
        retailerSession.accessToken,
        GET_FULFILLMENT_ORDER_CUSTOMER_DETAILS,
        {
            id: fulfillmentOrderId,
        },
    );
    const customerShippingDetails = fulfillmentOrderQuery.fulfillmentOrder?.destination;
    // TODO: If this MVP ends up validated, handle the case where shipping addresses can change, do not feature creep
    if (!customerShippingDetails) {
        throw new Error('There was no data inside the customer shipping details');
    }
    return customerShippingDetails;
}

// Fulfillment orders are routed by location
// However, there is a case where the same fulfillment orders has different suppliers, and it would have to be split up further
export const lambdaHandler = async (event: ShopifyEvent): Promise<APIGatewayProxyResult> => {
    let client: null | PoolClient = null;
    try {
        const pool = initializePool();
        client = await pool.connect();
        const shop = event.detail.metadata['X-Shopify-Shop-Domain'];
        const shopifyFulfillmentOrderId = event.detail.payload.fulfillment_order.id;
        const retailerSession = await getSession(shop, client);
        const isSynqsellOrder = await isSynqsellFulfillmentLocation(retailerSession, shopifyFulfillmentOrderId, client);
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
            retailerSession.accessToken,
            client,
        );
        const customerShippingDetails = await getCustomerShippingDetails(shopifyFulfillmentOrderId, retailerSession);
        await createSupplierOrders(fulfillmentOrdersBySupplier, retailerSession, customerShippingDetails, client);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully created order for suppliers.',
            }),
        };
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Failed to create order for suppliers.',
            }),
        };
    } finally {
        if (client) {
            client.release();
        }
    }
};
