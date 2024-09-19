import { PoolClient } from 'pg';
import { EditedVariant } from '../types';
import { createMapToRestObj, mutateAndValidateGraphQLData } from '../util';
import { PRODUCT_VARIANT_BULK_UPDATE } from '../graphql';

type QueryData = {
    retailerShopifyProductId: string;
    retailerAccessToken: string;
    retailerShop: string;
    retailerShopifyVariantId: string;
    supplierShopifyVariantId: string;
    retailerShopifyLocationId: string;
};

type GroupedQueryDataWithUpdateFields = Map<
    string,
    {
        retailerAccessToken: string;
        retailerShop: string;
        retailerShopifyLocationId: string;
        variants: {
            retailerShopifyVariantId: string;
            retailPrice: string;
            inventory: number;
        }[];
    }
>;

async function updateRetailerDataOnShopify(data: GroupedQueryDataWithUpdateFields) {
    try {
        const retailerShopifyProductsIds = Array.from(data.keys());
        await Promise.all(
            retailerShopifyProductsIds.map((productId) => {
                const updateData = data.get(productId);
                if (!updateData) {
                    throw new Error('Product id is not valid for getting update data.');
                }
                const variantsInput = updateData.variants.map((variant) => {
                    return {
                        inventoryQuantities: [
                            {
                                availableQuantity: variant.inventory,
                                locationId: updateData.retailerShopifyLocationId,
                            },
                        ],
                        price: variant.retailPrice,
                    };
                });
                return mutateAndValidateGraphQLData(
                    updateData.retailerShop,
                    updateData.retailerAccessToken,
                    PRODUCT_VARIANT_BULK_UPDATE,
                    {
                        productId: productId,
                        variants: variantsInput,
                    },
                    'Could not update variant details.',
                );
            }),
        );
    } catch (error) {
        throw new Error('Failed to update product data on Shopify.');
    }
}

function getRetailerProductData(
    queryData: QueryData[],
    editedVariantMap: Map<string, Omit<EditedVariant, 'shopifyVariantId'>>,
) {
    const retailerProductData: GroupedQueryDataWithUpdateFields = new Map();
    queryData.forEach((row) => {
        const prevValue = retailerProductData.get(row.retailerShopifyProductId);
        const supplierVariantDetails = editedVariantMap.get(row.supplierShopifyVariantId);
        const newRetailPrice = supplierVariantDetails?.price;
        const newInventory = supplierVariantDetails?.newInventory;
        if (!newRetailPrice || !newInventory) {
            throw new Error('Retail price or inventory is not defined.');
        }

        const prevVariants = prevValue?.variants ?? [];
        const newVariants = [
            ...prevVariants,
            {
                retailerShopifyVariantId: row.retailerShopifyVariantId,
                retailPrice: newRetailPrice,
                inventory: editedVariantMap.get(row.supplierShopifyVariantId)?.newInventory ?? 0,
            },
        ];
        retailerProductData.set(row.retailerShopifyProductId, {
            retailerAccessToken: row.retailerAccessToken,
            retailerShop: row.retailerShop,
            retailerShopifyLocationId: row.retailerShopifyLocationId,
            variants: newVariants,
        });
    });
    return retailerProductData;
}

// if the supplier changes the inventory or retail price, it should be updated for all the retailers that imported the product
// key is supplier shopify variant id, values inside map are the remaining fields
// TODO: handle update data in prisma
async function broadcastSupplierProductModifications(
    editedVariants: EditedVariant[],
    supplierShopifyProductId: string,
    client: PoolClient,
) {
    const editedVariantMap = createMapToRestObj(editedVariants, 'shopifyVariantId');
    const importedVariantDataQuery = `
      SELECT 
        "ImportedProduct"."shopifyProductId" as "retailerShopifyId",
        "Session"."accessToken" as "retailerAccessToken",
        "Session"."shop" as "retailerShop",
        "ImportedVariant"."shopifyVariantId" as "retailerShopifyVariantId",
        "Variant"."shopifyVariantId" as "supplierShopifyVariantId",
        "FulfillmentService"."shopifyLocationId" as "retailerShopifyLocationId"
      FROM "Product"
      INNER JOIN "Variant" ON "Variant"."productId" = "Product"."id"
      INNER JOIN "ImportedVariant" ON "ImportedVariant"."prismaVariantId" = "Variant"."id"
      INNER JOIN "ImportedProduct" ON "ImportedProduct"."id" = "ImportedVariant"."importedProductId"
      INNER JOIN "Session" ON "ImportedProduct"."retailerId" = "Session"."id"
      INNER JOIN "FulfillmentService" ON "FulfillmentService"."sessionId" = "Session"."id"
      WHERE "Product"."shopifyProductId" = $1  
    `;
    const res = await client.query(importedVariantDataQuery, [supplierShopifyProductId]);
    if (res.rows.length === 0) {
        return;
    }
    const data: QueryData[] = res.rows;
    const retailerProductData = getRetailerProductData(data, editedVariantMap);
    await updateRetailerDataOnShopify(retailerProductData);
}

export default broadcastSupplierProductModifications;
