import { PoolClient } from 'pg';
import { PriceListDetails } from '../../types';
import { createMapToRestObj } from '../../util';
type ShopifyVariantIdAndSupplierProfit = {
    shopifyVariantId: string;
    supplierProfit: string;
};

type VariantDetail = {
    shopifyVariantId: string;
    retailPrice: string;
};

const PRICE_LIST_PRICING_STRATEGY = {
    WHOLESALE: 'WHOLESALE',
    MARGIN: 'MARGIN',
} as const;

function round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    const roundedValue = Math.round(value * factor) / factor;
    return roundedValue;
}

function getPricingDetailsMargin(editedVariants: VariantDetail[], priceList: PriceListDetails) {
    if (priceList.pricingStrategy !== PRICE_LIST_PRICING_STRATEGY.MARGIN) {
        throw new Error('Cannot include supplier profit calculation for margin price list.');
    }
    const margin = priceList.margin;
    if (!margin) {
        throw new Error('Margin rate is undefined in price list, even though price list is margin.');
    }
    const marginPercentage = margin / 100;

    const prices = editedVariants.map((variant) => {
        const retailPrice = Number(variant.retailPrice);
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
    return prices;
}

async function getPricingDetailsWholesale(
    editedVariants: VariantDetail[],
    priceList: PriceListDetails,
    supplierShopifyProductId: string,
    client: PoolClient,
) {
    const shopifyVariantIdAndSupplierProfitQuery = `
        SELECT 
            "Variant"."shopifyVariantId" AS "shopifyVariantId", 
            "Variant"."supplierProfit" AS "supplierProfit"
        FROM "Variant"
        INNER JOIN "Product" ON "Product"."id" = "Variant"."productId"
        WHERE 
            "Product"."shopifyProductId" = $1 AND 
            "Product"."priceListId" = $2
    `;
    const shopifyVariantIdAndSupplierProfitRes: ShopifyVariantIdAndSupplierProfit[] = (
        await client.query(shopifyVariantIdAndSupplierProfitQuery, [supplierShopifyProductId, priceList.id])
    ).rows;

    const shopifyVariantIdToSupplierProfit = createMapToRestObj(
        shopifyVariantIdAndSupplierProfitRes,
        'shopifyVariantId',
    );
    const prices = editedVariants.map(({ shopifyVariantId, retailPrice }) => {
        const supplierProfit = shopifyVariantIdToSupplierProfit.get(shopifyVariantId)?.supplierProfit;
        if (supplierProfit === undefined) {
            throw new Error('Supplier profit was not found when retrieving wholesale price.');
        }
        const retailerPayment = round(Number(retailPrice) - Number(supplierProfit), 2).toFixed(2);
        return {
            shopifyVariantId: shopifyVariantId,
            retailPrice: retailPrice,
            retailerPayment: retailerPayment,
            supplierProfit: supplierProfit,
        };
    });

    return prices;
}

// Price Lists can have two strategies: a pricing strategy based on margin and pricing strategy based on fixed wholesale rate
// If it's based on margin, we have to recalculate the supplier profit
// If it's based on fixed wholesale rate, we don't have to calculate supplier profit
async function getPricingDetails(
    variants: VariantDetail[],
    priceList: PriceListDetails,
    supplierShopifyProductId: string,
    client: PoolClient,
) {
    if (priceList.pricingStrategy === PRICE_LIST_PRICING_STRATEGY.MARGIN) {
        return getPricingDetailsMargin(variants, priceList);
    } else if (priceList.pricingStrategy === PRICE_LIST_PRICING_STRATEGY.WHOLESALE) {
        return await getPricingDetailsWholesale(variants, priceList, supplierShopifyProductId, client);
    } else {
        throw new Error('Price list pricing strategy not handled.');
    }
}

export default getPricingDetails;
