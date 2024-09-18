import { APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { initializePool } from './db';

// Command to debug deleteProducts locally
// sam local invoke DeleteProductsLambda --event ./deleteProducts/app_event.json

type ShopifyEvent = {
    version: string;
    id: string;
    'detail-type': string;
    source: string;
    account: string;
    time: string;
    region: string;
    resources: string[];
    detail: {
        'X-Shopify-Topic': string;
        'X-Shopify-Hmac-Sha256': string;
        'X-Shopify-Shop-Domain': string;
        'X-Shopify-Webhook-Id': string;
        'X-Shopify-Triggered-At': string;
        'X-Shopify-Event-Id': string;
        payload: { sample: 'sample' }; // TODO: add payload details
    };
};

export const lambdaHandler = async (event: ShopifyEvent): Promise<APIGatewayProxyResult> => {
    let client: null | PoolClient = null;
    try {
        const pool = initializePool();
        client = await pool.connect();
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
