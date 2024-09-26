import { composeGid } from '@shopify/admin-graphql-api-utilities';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { mutateAndValidateGraphQLData } from './util';
import { DELETE_PRODUCT_MUTATION } from './graphql';
import { initializePool } from './db';

// Command to debug deleteProducts locally
// sam local invoke DeleteProductsFunction --event ./deleteProducts/app_event.json

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
        metadata: {
            'Content-Type': string;
            'X-Shopify-Topic': string;
            'X-Shopify-Hmac-Sha256': string;
            'X-Shopify-Shop-Domain': string;
            'X-Shopify-Webhook-Id': string;
            'X-Shopify-Triggered-At': string;
            'X-Shopify-Event-Id': string;
        };
        payload: {
            id: number;
        };
    };
};

async function isRetailerProduct(shopifyDeletedProductId: string, client: PoolClient) {
    const productQuery = `SELECT FROM "ImportedProduct" WHERE "shopifyProductId" = $1 LIMIT 1`;
    const res = await client.query(productQuery, [shopifyDeletedProductId]);
    if (res.rows.length > 0) {
        return true;
    }
    return false;
}

async function isSupplierProduct(shopifyDeletedProductId: string, client: PoolClient) {
    const productQuery = `SELECT FROM "Product" WHERE "shopifyProductId" = $1 LIMIT 1`;
    const res = await client.query(productQuery, [shopifyDeletedProductId]);
    if (res.rows.length > 0) {
        return true;
    }
    return false;
}

async function handleDeletedProductIsSupplierProduct(shopifyDeletedProductId: string, client: PoolClient) {
    // delete all the retailer's products,
    try {
        const allRetailerImportedProductsQuery = `
            SELECT "ImportedProduct"."shopifyProductId", "Session"."shop", "Session"."accessToken"
            FROM "Product"
            INNER JOIN "ImportedProduct" ON "Product"."id" = "ImportedProduct"."prismaProductId"
            INNER JOIN "Session" ON "ImportedProduct"."retailerId" = "Session"."id"
            WHERE "Product"."shopifyProductId" = $1
        `;
        const res = await client.query(allRetailerImportedProductsQuery, [shopifyDeletedProductId]);
        const deleteRetailerImportedProductPromises = res.rows.map(({ shopifyProductId, shop, accessToken }) => {
            return mutateAndValidateGraphQLData(
                shop,
                accessToken,
                DELETE_PRODUCT_MUTATION,
                {
                    id: shopifyProductId,
                },
                'Could not delete product for retailer.',
            );
        });
        await Promise.all(deleteRetailerImportedProductPromises);
        const deleteSupplierProductMutation = `DELETE FROM "Product" WHERE "shopifyProductId" = $1`;
        await client.query(deleteSupplierProductMutation, [shopifyDeletedProductId]);
    } catch (error) {
        console.error(error);
        throw new Error('Failed to handle supplier product deletion');
    }
}

// if this is the case, we just need to delete it from the database
async function handleDeletedProductIsRetailerProduct(shopifyDeletedProductId: string, client: PoolClient) {
    const productDeleteMutation = `DELETE FROM "ImportedProduct" WHERE "shopifyProductId" = $1`;
    await client.query(productDeleteMutation, [shopifyDeletedProductId]);
}

export const lambdaHandler = async (event: ShopifyEvent): Promise<APIGatewayProxyResult> => {
    let client: null | PoolClient = null;
    try {
        const pool = initializePool();
        const {
            detail: { payload },
        } = event;
        const { id } = payload;
        const shopifyDeletedProductId = composeGid('Product', id);
        client = await pool.connect();
        const isRetailerProductResult = await isRetailerProduct(shopifyDeletedProductId, client);
        const isSupplierProductResult = await isSupplierProduct(shopifyDeletedProductId, client);

        if (!isSupplierProductResult && !isRetailerProductResult) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'There were no products to delete.',
                }),
            };
        } else if (isSupplierProductResult) {
            await handleDeletedProductIsSupplierProduct(shopifyDeletedProductId, client);
        } else if (isRetailerProductResult) {
            await handleDeletedProductIsRetailerProduct(shopifyDeletedProductId, client);
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
