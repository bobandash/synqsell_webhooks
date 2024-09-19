import { APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { initializePool } from './db';
import { composeGid } from '@shopify/admin-graphql-api-utilities';
import { createMapIdToRestObj, fetchAndValidateGraphQLData, mutateAndValidateGraphQLData } from './util';
import { PRODUCT_VARIANT_BULK_UPDATE, PRODUCT_VARIANT_INFO } from './graphql';
import { ProductVariantInfoQuery } from './types/admin.generated';
import { EditedVariant } from './types';
import { broadcastSupplierProductModifications, revertRetailerProductModifications } from './helper';
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
            admin_graphql_api_id: string;
            body_html: string | null;
            created_at: string | null;
            handle: string;
            id: number;
            product_type: string;
            published_at: string;
            template_suffix: string | null;
            title: string;
            updated_at: string;
            vendor: string;
            status: string;
            published_scope: string;
            tags: string;
            variants: {
                admin_graphql_api_id: string;
                barcode: string | null;
                compare_at_price: string;
                created_at: string;
                id: number;
                inventory_policy: string;
                position: number;
                price: string;
                product_id: number;
                sku: string | null;
                taxable: boolean;
                title: string;
                updated_at: string;
                option1: string;
                option2: string | null;
                option3: string | null;
                image_id: number | null;
                inventory_item_id: number | null;
                inventory_quantity: number;
                old_inventory_quantity: number;
            }[];
            options: any[];
            images: any[];
            image: any | null;
            media: any[];
            variant_gids: {
                admin_graphql_api_id: string;
                updated_at: string;
            }[];
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

export const lambdaHandler = async (event: ShopifyEvent): Promise<APIGatewayProxyResult> => {
    let client: null | PoolClient = null;
    try {
        const pool = initializePool();
        client = await pool.connect();
        const payload = event.detail.payload;
        const shopifyProductId = payload.admin_graphql_api_id;
        const isRetailerProductResult = await isRetailerProduct(shopifyProductId, client);
        const isSupplierProductResult = await isSupplierProduct(shopifyProductId, client);

        // there is no old price, so we cannot check if the variant price has been updated
        // even though it consumes GraphQL resources, we are going to broadcast the price changes
        const editedVariants = payload.variants.map((variant) => {
            return {
                shopifyVariantId: composeGid('Variant', variant.id),
                hasUpdatedInventory: variant.inventory_quantity !== variant.old_inventory_quantity,
                newInventory: variant.inventory_quantity,
                price: variant.price,
            };
        });

        if (!isSupplierProductResult && !isRetailerProductResult) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Do not need to handle logic for products not in Synqsell.',
                }),
            };
        }

        if (isSupplierProductResult) {
            await broadcastSupplierProductModifications(editedVariants, shopifyProductId, client);
        } else if (isRetailerProductResult) {
            await revertRetailerProductModifications(editedVariants, shopifyProductId, client);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully handled product update webhook.',
            }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Failed to handle product update webhook.',
                error: (error as Error).message,
            }),
        };
    } finally {
        if (client) {
            client.release();
        }
    }
};
