import { composeGid } from '@shopify/admin-graphql-api-utilities';
import { APIGatewayProxyResult } from 'aws-lambda';
import { SecretsManager } from 'aws-sdk';
import { Pool, PoolClient } from 'pg';

type ProductDeletePayload = {
    id: number;
};

let pool: Pool | null = null;
const secretManagerClient = new SecretsManager();

async function getDbConfig() {
    const secretManagerResult = await secretManagerClient
        .getSecretValue({
            SecretId: process.env.SECRET_MANAGER_ID ?? '',
        })
        .promise();
    return JSON.parse(secretManagerResult.SecretString as string);
}

async function initializePool() {
    if (!pool) {
        const dbConfig = await getDbConfig();
        pool = new Pool(dbConfig);
    }
    return pool;
}

export const lambdaHandler = async (event: ProductDeletePayload): Promise<APIGatewayProxyResult> => {
    let client: null | PoolClient = null;
    try {
        const pool = await initializePool();
        const { id } = event;
        const shopifyDeletedProductId = composeGid('Product', id);
        client = await pool.connect();
        const deleteProductQuery = 'DELETE FROM "Product" WHERE shopifyProductId = $1';
        const res = await client.query(deleteProductQuery, [shopifyDeletedProductId]);

        if (res.rowCount) {
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
