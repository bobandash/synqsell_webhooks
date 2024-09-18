// TODO: rename the file later

import { composeGid } from "@shopify/admin-graphql-api-utilities";
// returns 2 sessions
// 1 price list, 1 product in the price list, 1 variant
// 1 imported product, 1 imported variant
const DEFAULT_ITEMS = {
  SHOPIFY_PRODUCT_ID: 8688664903915,
  SHOPIFY_VARIANT_ID: 45667254599915,
  SHOPIFY_INVENTORY_ITEM_ID: 47905097187563,
  IMPORTED_SHOPIFY_PRODUCT_ID: 8740026417387,
  IMPORTED_SHOPIFY_VARIANT_ID: 45806359675115,
  IMPORTED_SHOPIFY_INVENTORY_ITEM_ID: 47905097187563,
};

export const priceListWithProductAndImportedProductMutation = `
    BEGIN;
    INSERT INTO "Session" (id, "shop", "state", "accessToken")
    VALUES (
      'offline_quickstart-3fe7f8c3.myshopify.com',
      'quickstart-3fe7f8c3.myshopify.com',
      '',
      'shpat_2cd4b723a6508644'
    ) RETURNING id INTO supplier_id;

    INSERT INTO "Session" (id, "shop", "state", "accessToken")
    VALUES (
      'offline_quickstart-2.myshopify.com',
      'quickstart-2.myshopify.com',
      '',
      'shpat_2cd4b723a6508644'
    ) RETURNING id INTO retailer_id;

    INSERT INTO "PriceList" (name, "isGeneral", "requiresApprovalToImport", "pricingStrategy", "supplierId")
    VALUES (
      'General',
      true,
      false,
      'MARGIN',
      supplier_id
    ) RETURNING id INTO price_list_id;

    INSERT INTO "Product" ("shopifyProductId", "priceListId")
    VALUES (
      '${composeGid("Product", DEFAULT_ITEMS.SHOPIFY_PRODUCT_ID)}',
      price_list_id
    ) RETURNING id INTO product_id;

    INSERT INTO "Variant" ("shopifyVariantId", "productId", "retailPrice", "retailerPayment", "supplierProfit")
    VALUES (
      '${composeGid("Variant", DEFAULT_ITEMS.SHOPIFY_VARIANT_ID)}',
      product_id,
      '50',
      '5',
      '45'
    ) RETURNING id INTO variant_id;

    INSERT INTO "InventoryItem" ("shopifyInventoryItemId", "variantId")
    VALUES (
      '${composeGid("InventoryItem", DEFAULT_ITEMS.SHOPIFY_INVENTORY_ITEM_ID)}',
      variant_id
    ) RETURNING id INTO inventory_item_id;

    INSERT INTO "ImportedProduct" ("prismaProductId", "shopifyProductId", "retailerId")
    VALUES (
      product_id,
      '${composeGid("Product", DEFAULT_ITEMS.IMPORTED_SHOPIFY_PRODUCT_ID)}',
      retailer_id
    ) RETURNING id INTO imported_product_id

    INSERT INTO "ImportedVariant" ("importedProductId", "shopifyVariantId","prismaVariantId")
    VALUES (
      imported_product_id,
      '${composeGid("Variant", DEFAULT_ITEMS.IMPORTED_SHOPIFY_VARIANT_ID)}',
      variant_id
    ) RETURNING id INTO imported_variant_id

    INSERT INTO "ImportedInventoryItem" ("shopifyInventoryItemId", "importedVariantId", "prismaInventoryItemId")
    VALUES (
      '${composeGid(
        "InventoryItem",
        DEFAULT_ITEMS.IMPORTED_SHOPIFY_INVENTORY_ITEM_ID
      )}',
      imported_variant_id,
      inventory_item_id
    )
    COMMIT;
  `;
