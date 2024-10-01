import { APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { initializePool } from './db';
import { ROLES, RolesProps, ShopifyEvent } from './types';
import { handleFulfillmentUpdate, handleShipmentStatusUpdate } from './helper';
import { composeGid } from '@shopify/admin-graphql-api-utilities';

// This function listens to when the fulfillment ever updates
// fulfillment includes: fulfillment / tracking number being cancelled and shipment status changing
// list of potential values related to fulfillment
// https://shopify.dev/docs/api/admin-rest/2024-07/resources/fulfillment#put-orders-order-id-fulfillments-fulfillment-id
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

export const lambdaHandler = async (event: ShopifyEvent): Promise<APIGatewayProxyResult> => {
    let client: null | PoolClient = null;
    console.log(event);
    try {
        const pool = initializePool();
        client = await pool.connect();
        const payload = event.detail.payload;
        const shop = event.detail.metadata['X-Shopify-Shop-Domain'];
        const {
            status: fulfillmentStatus,
            shipment_status: shipmentStatus,
            order_id: rawOrderId,
            admin_graphql_api_id: shopifyFulfillmentId,
        } = payload;
        const shopifyOrderId = composeGid('Order', rawOrderId);

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

        // coordinator functions to handle all the possible cases
        await handleFulfillmentUpdate({
            shop,
            shopifyFulfillmentId,
            fulfillmentStatus,
            payload,
            isRetailerFulfillment,
            isSupplierFulfillment,
            client,
        });

        await handleShipmentStatusUpdate({
            shipmentStatus,
            shop,
            shopifyFulfillmentId,
            payload,
            shopifyOrderId,
            isRetailerFulfillment,
            isSupplierFulfillment,
            client,
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully handled fulfillments update procedure.',
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
