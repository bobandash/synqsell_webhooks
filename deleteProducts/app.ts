import { composeGid } from '@shopify/admin-graphql-api-utilities';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Pool, PoolClient } from 'pg';

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
        payload: {
            id: number;
        };
    };
};

let pool: Pool | null = null;

async function initializePool() {
    if (!pool) {
        // https://stackoverflow.com/questions/76899023/rds-while-connection-error-no-pg-hba-conf-entry-for-host
        pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DATABASE,
            password: process.env.DB_PASSWORD,
            port: Number(process.env.DB_PORT) ?? 5432,
            max: 20,
            ssl: {
                rejectUnauthorized: false,
            },
        });
    }
    return pool;
}

export const lambdaHandler = async (event: ShopifyEvent): Promise<APIGatewayProxyResult> => {
    let client: null | PoolClient = null;
    try {
        const pool = await initializePool();
        const {
            detail: { payload },
        } = event;
        const { id } = payload;
        const shopifyDeletedProductId = composeGid('Product', id);
        client = await pool.connect();
        const deleteProductQuery = `DELETE FROM "Product" WHERE "shopifyProductId" = $1`;
        const res = await client.query(deleteProductQuery, [shopifyDeletedProductId]);
        if (res.rowCount === 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'There were no products to delete.',
                }),
            };
        }
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully deleted products from database.',
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
