import { APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { initializePool } from './db';
import type { ShopifyShippingDetails } from './types';

type CustomProxyEvent = Omit<APIGatewayProxyResult, 'body'> & { body: string };

// TODO: Before we continue, console log the carrier service to make sure it works
export const lambdaHandler = async (event: CustomProxyEvent): Promise<APIGatewayProxyResult> => {
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
