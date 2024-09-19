import { APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { initializePool } from './db';
import { composeGid } from '@shopify/admin-graphql-api-utilities';
import { createMapIdToRestObj, fetchAndValidateGraphQLData, mutateAndValidateGraphQLData } from './util';
import { PRODUCT_VARIANT_BULK_UPDATE, PRODUCT_VARIANT_INFO } from './graphql';
import { ProductVariantInfoQuery } from './types/admin.generated';
import { EditedVariant } from './types';
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

type VariantAndImportedVariant = {
    retailerShopifyVariantId: string;
    supplierShopifyVariantId: string;
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

async function getSessionsFromImportedProduct(shopifyProductId: string, client: PoolClient) {
    const retailerSessionQuery = `
        SELECT session.* 
        FROM "ImportedProduct"
        JOIN "Session" session ON "ImportedProduct"."retailerId" = session.id 
        WHERE "shopifyProductId" = $1 
    `;
    const supplierSessionQuery = `
        SELECT "Session".* 
        FROM "ImportedProduct"
        JOIN "Product" ON "ImportedProduct"."prismaProductId" = "Product".id
        JOIN "PriceList" ON "Product"."priceListId" = "PriceList".id
        JOIN "Session" ON "PriceList"."supplierId" = "Session".id
        WHERE "ImportedProduct"."shopifyProductId" = $1 
    `;

    const retailerSession = (await client.query(retailerSessionQuery)).rows[0];
    const supplierSession = (await client.query(supplierSessionQuery)).rows[0];

    return { retailerSession, supplierSession };
}

async function getFulfillmentService(sessionId: string, client: PoolClient) {
    try {
        const fulfillmentServiceQuery = `SELECT * FROM "FulfillmentService" WHERE "sessionId" = $1 LIMIT 1`;
        const res = await client.query(fulfillmentServiceQuery, [sessionId]);
        if (res.rows.length < 1) {
            throw new Error('Could not fetch fulfillment service.');
        }
        const fulfillmentService = res.rows[0];
        return fulfillmentService;
    } catch (error) {
        throw error;
    }
}

// if the retailer changes the inventory or retail price, it is should be reverted back to the supplier's data
// TODO: right now, this triggers an infinite loop, you should
async function revertRetailerProductModifications(
    editedVariants: EditedVariant[],
    importedShopifyProductId: string,
    client: PoolClient,
) {
    const { supplierSession, retailerSession } = await getSessionsFromImportedProduct(importedShopifyProductId, client);
    // returns { retailerShopifyVariantId: "", supplierShopifyVariantId: ""}[]
    const productVariantIdsAndImportedVariantIdsQuery = `
        SELECT 
            "ImportedVariant"."shopifyVariantId" as "retailerShopifyVariantId",
            "Variant"."shopifyVariantId" as "supplierShopifyVariantId"
        FROM "ImportedVariant"
        INNER JOIN "Variant" ON "ImportedVariant"."prismaVariantId" = "Variant"."id"
        WHERE "ImportedVariant"."shopifyVariantId" = ANY($1)  
    `;
    const importedVariantShopifyIds = editedVariants.map(({ shopifyVariantId }) => shopifyVariantId);
    const productVariantIdAndImportedVariantIdData: VariantAndImportedVariant[] = (
        await client.query(productVariantIdsAndImportedVariantIdsQuery, [importedVariantShopifyIds])
    ).rows;
    const supplierToRetailerVariantId = createMapIdToRestObj(
        productVariantIdAndImportedVariantIdData,
        'supplierShopifyVariantId',
    );
    const retailerFulfillmentService = await getFulfillmentService(retailerSession.id, client);
    const supplierShopifyVariantIds = productVariantIdAndImportedVariantIdData.map(
        ({ supplierShopifyVariantId }) => supplierShopifyVariantId,
    );
    const supplierVariantInfo = await Promise.all(
        supplierShopifyVariantIds.map((variantId) => {
            return fetchAndValidateGraphQLData<ProductVariantInfoQuery>(
                supplierSession.shop,
                supplierSession.accessToken,
                PRODUCT_VARIANT_INFO,
                {
                    id: variantId,
                },
            );
        }),
    );

    const retailerVariantEditInput = supplierVariantInfo.map((variant) => {
        const supplierVariantId = variant.productVariant?.id;
        const supplierInventory = variant.productVariant?.inventoryQuantity ?? 0;
        const supplierPrice = variant.productVariant?.price;
        const retailerVariantId = supplierToRetailerVariantId.get(supplierVariantId ?? '') ?? '';
        if (!retailerVariantId) {
            throw new Error(`Retailer's variant id is invalid,`);
        }
        return {
            id: retailerVariantId,
            inventoryQuantities: [
                {
                    availableQuantity: supplierInventory,
                    locationId: retailerFulfillmentService.shopifyLocationId,
                },
            ],
            price: supplierPrice,
        };
    });

    await mutateAndValidateGraphQLData(
        retailerSession.shop,
        retailerSession.accessToken,
        PRODUCT_VARIANT_BULK_UPDATE,
        {
            productId: importedShopifyProductId,
            variants: retailerVariantEditInput,
        },
        'Failed to update product variant information for retailer.',
    );
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
                    message: 'SynqSell does not need to handle logic for products not in its marketplace.',
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
