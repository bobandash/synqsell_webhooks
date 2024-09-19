import { PoolClient } from 'pg';
import { EditedVariant } from '../types';
import { createMapToRestObj, fetchAndValidateGraphQLData, mutateAndValidateGraphQLData } from '../util';
import { PRODUCT_VARIANT_BULK_UPDATE, PRODUCT_VARIANT_INFO } from '../graphql';
import { ProductVariantInfoQuery } from '../types/admin.generated';
import { composeGid } from '@shopify/admin-graphql-api-utilities';

type VariantAndImportedVariant = {
    retailerShopifyVariantId: string;
    supplierShopifyVariantId: string;
};

type Session = {
    id: string;
    shop: string;
    state: string;
    isOnline: boolean;
    scope?: string;
    expires?: Date;
    accessToken: string;
    userId?: bigint;
    firstName?: string;
    lastName?: string;
    email?: string;
    accountOwner: boolean;
    locale?: string;
    collaborator?: boolean;
    emailVerified?: boolean;
};

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

    const retailerSession = (await client.query(retailerSessionQuery, [shopifyProductId])).rows[0];
    const supplierSession = (await client.query(supplierSessionQuery, [shopifyProductId])).rows[0];

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

// checks if there are any important changes to price or inventory
async function hasImportantRetailerProductChanges(
    supplierShopifyVariantData: ProductVariantInfoQuery[],
    supplierVariantIdToRetailerVariantId: Map<string, Omit<VariantAndImportedVariant, 'supplierShopifyVariantId'>>,
    retailerEditedVariantsMap: Map<string, Omit<EditedVariant, 'shopifyVariantId'>>,
) {
    try {
        // compares the retailer and supplier variants to check if there's any discrepancies between price or inventory
        let hasImportantChange = false;
        supplierShopifyVariantData.forEach(({ productVariant: supplierProductVariant }) => {
            const supplierShopifyVariantId = supplierProductVariant?.id ?? '';
            const supplierPrice = supplierProductVariant?.price;
            const supplierInventory = supplierProductVariant?.inventoryQuantity;
            const retailerVariantId = supplierVariantIdToRetailerVariantId.get(
                composeGid('Variant', supplierShopifyVariantId),
            )?.retailerShopifyVariantId;
            if (!retailerVariantId) {
                throw new Error('Supplier variant cannot match with retailer variant.');
            }
            const retailerPrice = retailerEditedVariantsMap.get(retailerVariantId)?.price ?? 0;
            const retailerInventory = retailerEditedVariantsMap.get(retailerVariantId)?.newInventory ?? 0;

            if (
                Number(retailerPrice) !== Number(supplierPrice) ||
                Number(supplierInventory) !== Number(retailerInventory)
            ) {
                hasImportantChange = true;
            }
        });
        return hasImportantChange;
    } catch (error) {
        throw new Error('Failed to check if the retailer changed any important fields.');
    }
}

async function revertRetailerProductModificationOnShopify(
    supplierShopifyVariantData: ProductVariantInfoQuery[],
    supplierVariantIdToRetailerVariantId: Map<string, Omit<VariantAndImportedVariant, 'supplierShopifyVariantId'>>,
    retailerSession: Session,
    importedShopifyProductId: string,
    client: PoolClient,
) {
    try {
        const retailerFulfillmentService = await getFulfillmentService(retailerSession.id, client);
        const retailerVariantEditInput = supplierShopifyVariantData.map(({ productVariant }) => {
            const supplierVariantId = productVariant?.id ?? '';
            const supplierInventory = productVariant?.inventoryQuantity ?? 0;
            const supplierPrice = productVariant?.price;
            const retailerVariantId = supplierVariantIdToRetailerVariantId.get(
                composeGid('Variant', supplierVariantId),
            )?.retailerShopifyVariantId;
            if (!retailerVariantId) {
                throw new Error('Supplier variant cannot match with retailer variant.');
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
    } catch (error) {
        throw error;
    }
}

// if the retailer changes the inventory or retail price, it is should be reverted back to the supplier's data
// !!! NOTE: in order not to trigger infinite products/update webhooks being called, we need to check if any data needs to change in the first place
// Because there is another function calls to product/update TO retailer products
// And this function listens to the product/update webhook FROM the supplier products
async function revertRetailerProductModifications(
    editedVariants: EditedVariant[],
    importedShopifyProductId: string,
    client: PoolClient,
) {
    // retrieve all important data to perform operations
    const { supplierSession, retailerSession } = await getSessionsFromImportedProduct(importedShopifyProductId, client);
    const supplierAndRetailerVariantIdsQuery = `
        SELECT 
            "ImportedVariant"."shopifyVariantId" as "retailerShopifyVariantId",
            "Variant"."shopifyVariantId" as "supplierShopifyVariantId"
        FROM "ImportedVariant"
        INNER JOIN "Variant" ON "ImportedVariant"."prismaVariantId" = "Variant"."id"
        WHERE "ImportedVariant"."shopifyVariantId" = ANY($1)  
    `;
    const importedVariantShopifyIds = editedVariants.map(({ shopifyVariantId }) => shopifyVariantId);
    const baseAndImportedVariantData: VariantAndImportedVariant[] = (
        await client.query(supplierAndRetailerVariantIdsQuery, [importedVariantShopifyIds])
    ).rows;

    const supplierShopifyVariantIds = baseAndImportedVariantData.map(
        ({ supplierShopifyVariantId }) => supplierShopifyVariantId,
    );
    // creates a map of retailer's (imported product) shopifyVariantId to rest of fields
    const retailerEditedVariantsMap = createMapToRestObj(editedVariants, 'shopifyVariantId');
    const supplierVariantIdToRetailerVariantId = createMapToRestObj(
        baseAndImportedVariantData,
        'supplierShopifyVariantId',
    );
    const supplierShopifyVariantData: ProductVariantInfoQuery[] = await Promise.all(
        supplierShopifyVariantIds.map((shopifyVariantId) => {
            return fetchAndValidateGraphQLData<ProductVariantInfoQuery>(
                supplierSession.shop,
                supplierSession.accessToken,
                PRODUCT_VARIANT_INFO,
                {
                    id: shopifyVariantId,
                },
            );
        }),
    );
    // end all important data to perform operations

    const importantRetailerProductChangesExists = await hasImportantRetailerProductChanges(
        supplierShopifyVariantData,
        supplierVariantIdToRetailerVariantId,
        retailerEditedVariantsMap,
    );

    if (!importantRetailerProductChangesExists) {
        return;
    }

    await revertRetailerProductModificationOnShopify(
        supplierShopifyVariantData,
        supplierVariantIdToRetailerVariantId,
        retailerSession,
        importedShopifyProductId,
        client,
    );
}

export default revertRetailerProductModifications;
