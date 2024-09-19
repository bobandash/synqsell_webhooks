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

type PriceListDetails = {
    id: string;
    createdAt: Date;
    pricingStrategy: string;
    supplierId: string;
    isGeneral: boolean;
    name: string;
    requiresApprovalToImport?: boolean;
    margin?: number;
};

export const PRICE_LIST_PRICING_STRATEGY = {
    WHOLESALE: 'WHOLESALE',
    MARGIN: 'MARGIN',
} as const;

type ShopifyVariantIdAndSupplierProfit = {
    shopifyVariantId: string;
    supplierProfit: string;
};

// Price Lists can have two strategies: a pricing strategy based on margin and pricing strategy based on fixed wholesale rate
// If it's based on margin, we have to recalculate the supplier profit
// If it's based on fixed wholesale rate, we don't have to calculate supplier profit

// START: Functions related to updating prices in the database
function round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    const roundedValue = Math.round(value * factor) / factor;
    return roundedValue;
}

function getNewPricingDetails(editedVariants: EditedVariant[], priceList: PriceListDetails) {
    if (priceList.pricingStrategy !== PRICE_LIST_PRICING_STRATEGY.MARGIN) {
        throw new Error('Cannot include supplier profit calculation for margin price list.');
    }
    const margin = priceList.margin;
    if (!margin) {
        throw new Error('Margin rate is undefined in price list, even though price list is margin.');
    }
    const marginPercentage = margin / 100;

    return editedVariants.map((variant) => {
        const retailPrice = Number(variant.price);
        const retailerPayment = round(retailPrice * marginPercentage, 2);
        const supplierProfit = round(retailPrice - retailerPayment, 2);

        // Convert to string w/ two decimals to match database fields
        const retailPriceStr = retailPrice.toFixed(2);
        const retailerPaymentStr = retailerPayment.toFixed(2);
        const supplierProfitStr = supplierProfit.toFixed(2);

        return {
            shopifyVariantId: variant.shopifyVariantId,
            retailPrice: retailPriceStr,
            retailerPayment: retailerPaymentStr,
            supplierProfit: supplierProfitStr,
        };
    });
}

async function handleUpdateVariantsInMarginPriceList(
    editedVariants: EditedVariant[],
    priceList: PriceListDetails,
    dbProductId: string,
    client: PoolClient,
) {
    const variantPrices = getNewPricingDetails(editedVariants, priceList);
    const updateVariantPriceQuery = `
        UPDATE "Variant"
        SET "retailPrice" = $1,
            "retailerPayment" = $2,
            "supplierProfit" = $3
        WHERE
            "shopifyVariantId" = $4 AND
            "productId" = $5
    `;
    await Promise.all(
        variantPrices.map(({ shopifyVariantId, retailPrice, retailerPayment, supplierProfit }) => {
            return client.query(updateVariantPriceQuery, [
                retailPrice,
                retailerPayment,
                supplierProfit,
                shopifyVariantId,
                dbProductId,
            ]);
        }),
    );
}

async function handleUpdateVariantsInWholesalePriceList(
    editedVariants: EditedVariant[],
    dbProductId: string,
    client: PoolClient,
) {
    const shopifyVariantIdAndSupplierProfitQuery = `
        SELECT 
            "Variant"."shopifyVariantId" AS "shopifyVariantId", 
            "Variant"."supplierProfit" AS "supplierProfit"
        FROM "Variant"
        WHERE "Variant"."productId" = $1 
    `;
    const shopifyVariantIdAndSupplierProfitRes: ShopifyVariantIdAndSupplierProfit[] = (
        await client.query(shopifyVariantIdAndSupplierProfitQuery)
    ).rows;

    const shopifyVariantIdToSupplierProfit = createMapToRestObj(
        shopifyVariantIdAndSupplierProfitRes,
        'shopifyVariantId',
    );
    const updateVariantPriceQuery = `
        UPDATE "Variant"
        SET "retailPrice" = $1,
            "retailerPayment" = $2,
        WHERE
            "shopifyVariantId" = $3 AND
            "productId" = $4
    `;

    await Promise.all(
        editedVariants.map(({ shopifyVariantId, price }) => {
            const supplierProfit = shopifyVariantIdToSupplierProfit.get(shopifyVariantId);
            const retailerPayment = round(Number(price) - Number(supplierProfit), 2).toFixed(2);
            return client.query(updateVariantPriceQuery, [price, retailerPayment, shopifyVariantId, dbProductId]);
        }),
    );
}

async function updateVariantPricesDatabase(
    editedVariants: EditedVariant[],
    supplierShopifyProductId: string,
    client: PoolClient,
) {
    const priceListDetailsQuery = `
            SELECT "PriceList".* FROM "Product"
            INNER JOIN "PriceList" ON "Product"."priceListId" = "PriceList"."id"
            WHERE "Product"."shopifyProductId" = $1
        `;
    const res = await client.query(priceListDetailsQuery, [supplierShopifyProductId]);
    if (res.rows.length === 0) {
        throw new Error('No price list found.');
    }

    // the same product can be in multiple price lists
    const priceLists: PriceListDetails[] = res.rows;
    priceLists.forEach(async (priceList) => {
        const dbProductIdQuery = `
            SELECT "Product"."id" AS "dbProductId" FROM "Variant"
            INNER JOIN "Product" ON "Product"."id" = "Variant"."productId"
            WHERE 
                "Product"."priceListId" = $1 AND
                "Product"."shopifyProductId" = $2
            LIMIT 1
        `;
        const dbProductIdRes = await client.query(dbProductIdQuery, [priceList.id, supplierShopifyProductId]);
        if (dbProductIdRes.rows.length === 0) {
            throw new Error('Product for specified price list and shopify product id does not exist in database.');
        }
        const dbProductId: string = dbProductIdRes.rows[0].dbProductId;
        if (priceList.pricingStrategy === PRICE_LIST_PRICING_STRATEGY.MARGIN) {
            handleUpdateVariantsInMarginPriceList(editedVariants, priceList, dbProductId, client);
        } else if (priceList.pricingStrategy === PRICE_LIST_PRICING_STRATEGY.WHOLESALE) {
            handleUpdateVariantsInWholesalePriceList(editedVariants, dbProductId, client);
        }
    });
}
// EMD: Functions related to updating prices in the database

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
        if (newRetailPrice === undefined || newInventory === undefined) {
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
    await Promise.all([
        updateRetailerDataOnShopify(retailerProductData),
        updateVariantPricesDatabase(editedVariants, supplierShopifyProductId, client),
    ]);
}

export default broadcastSupplierProductModifications;
