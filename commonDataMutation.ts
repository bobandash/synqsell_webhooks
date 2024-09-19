// TODO: rename the file later
import { v4 as uuidv4 } from "uuid";
import { composeGid } from "@shopify/admin-graphql-api-utilities";
// returns 2 sessions
// 1 price list, 1 product in the price list, 1 variant
// 1 imported product, 1 imported variant
export const DEFAULT_ITEMS = {
  RETAILER_SESSION_ID: "offline_quickstart-3fe7f8c3.myshopify.com",
  SUPPLIER_SESSION_ID: "offline_quickstart-2.myshopify.com",
  SHOPIFY_PRODUCT_ID: 8688664903915,
  SHOPIFY_VARIANT_ID: 45667254599915,
  SHOPIFY_VARIANT_RETAIL_PRICE: "50.00",
  SHOPIFY_INVENTORY_ITEM_ID: 47905097187563,
  IMPORTED_SHOPIFY_PRODUCT_ID: 8740026417387,
  IMPORTED_SHOPIFY_VARIANT_ID: 45806359675115,
  IMPORTED_SHOPIFY_INVENTORY_ITEM_ID: 47905097187563,
  RETAILER_SHOP: "quickstart-3fe7f8c3.myshopify.com",
  RETAILER_ACCESS_TOKEN: "shpat_2cd4b723a6508644",
  SUPPLIER_SHOP: "quickstart-2.myshopify.com",
  SUPPLIER_ACCESS_TOKEN: "shpat_2cd4b723a6508644",
  RETAILER_SHOPIFY_FULFILLMENT_SERVICE_ID: "123",
  RETAILER_SHOPIFY_LOCATION_ID: "1234",
};

// most common sample case
// creates 1 product with 1 variant, and 1 inventory item id
// 1 imported product, 1 imported variant, and 1 imported inventory item id
export const priceListWithProductAndImportedProductMutation = `
  BEGIN;

  INSERT INTO "Session" (id, "shop", "state", "accessToken")
  VALUES (
    '${DEFAULT_ITEMS.SUPPLIER_SESSION_ID}',
    '${DEFAULT_ITEMS.SUPPLIER_SHOP}',
    '',
    '${DEFAULT_ITEMS.SUPPLIER_ACCESS_TOKEN}'
  );

  INSERT INTO "Session" (id, "shop", "state", "accessToken")
  VALUES (
    '${DEFAULT_ITEMS.RETAILER_SESSION_ID}',
    '${DEFAULT_ITEMS.RETAILER_SHOP}',
    '',
    '${DEFAULT_ITEMS.RETAILER_ACCESS_TOKEN}'
  );

  INSERT INTO "PriceList" (id, name, "isGeneral", "requiresApprovalToImport", "pricingStrategy", "supplierId")
  VALUES (
    '${uuidv4()}',
    'General',
    true,
    false,
    'MARGIN',
    (SELECT id FROM "Session" WHERE id = '${DEFAULT_ITEMS.SUPPLIER_SESSION_ID}')
  );

  INSERT INTO "Product" (id, "shopifyProductId", "priceListId")
  VALUES (
    '${uuidv4()}',
    '${composeGid("Product", DEFAULT_ITEMS.SHOPIFY_PRODUCT_ID)}',
    (SELECT id FROM "PriceList" WHERE name = 'General')
  );

  INSERT INTO "Variant" (id, "shopifyVariantId", "productId", "retailPrice", "retailerPayment", "supplierProfit")
  VALUES (
    '${uuidv4()}',
    '${composeGid("Variant", DEFAULT_ITEMS.SHOPIFY_VARIANT_ID)}',
    (SELECT id FROM "Product" WHERE "shopifyProductId" = '${composeGid(
      "Product",
      DEFAULT_ITEMS.SHOPIFY_PRODUCT_ID
    )}'),
    '${DEFAULT_ITEMS.SHOPIFY_VARIANT_RETAIL_PRICE}',
    '5',
    '45'
  );

  INSERT INTO "InventoryItem" (id, "shopifyInventoryItemId", "variantId")
  VALUES (
    '${uuidv4()}',
    '${composeGid("InventoryItem", DEFAULT_ITEMS.SHOPIFY_INVENTORY_ITEM_ID)}',
    (SELECT id FROM "Variant" WHERE "shopifyVariantId" = '${composeGid(
      "Variant",
      DEFAULT_ITEMS.SHOPIFY_VARIANT_ID
    )}')
  );

  INSERT INTO "ImportedProduct" (id, "prismaProductId", "shopifyProductId", "retailerId")
  VALUES (
    '${uuidv4()}',
    (SELECT id FROM "Product" WHERE "shopifyProductId" = '${composeGid(
      "Product",
      DEFAULT_ITEMS.SHOPIFY_PRODUCT_ID
    )}'),
    '${composeGid("Product", DEFAULT_ITEMS.IMPORTED_SHOPIFY_PRODUCT_ID)}',
    (SELECT id FROM "Session" WHERE id = '${DEFAULT_ITEMS.RETAILER_SESSION_ID}')
  );

  INSERT INTO "ImportedVariant" (id, "importedProductId", "shopifyVariantId", "prismaVariantId")
  VALUES (
    '${uuidv4()}',
    (SELECT id FROM "ImportedProduct" WHERE "shopifyProductId" = '${composeGid(
      "Product",
      DEFAULT_ITEMS.IMPORTED_SHOPIFY_PRODUCT_ID
    )}'),
    '${composeGid("Variant", DEFAULT_ITEMS.IMPORTED_SHOPIFY_VARIANT_ID)}',
    (SELECT id FROM "Variant" WHERE "shopifyVariantId" = '${composeGid(
      "Variant",
      DEFAULT_ITEMS.SHOPIFY_VARIANT_ID
    )}')
  );

  INSERT INTO "ImportedInventoryItem" (id, "shopifyInventoryItemId", "importedVariantId", "prismaInventoryItemId")
  VALUES (
    '${uuidv4()}',
    '${composeGid(
      "InventoryItem",
      DEFAULT_ITEMS.IMPORTED_SHOPIFY_INVENTORY_ITEM_ID
    )}',
    (SELECT id FROM "ImportedVariant" WHERE "shopifyVariantId" = '${composeGid(
      "Variant",
      DEFAULT_ITEMS.IMPORTED_SHOPIFY_VARIANT_ID
    )}'),
    (SELECT id FROM "InventoryItem" WHERE "shopifyInventoryItemId" = '${composeGid(
      "InventoryItem",
      DEFAULT_ITEMS.SHOPIFY_INVENTORY_ITEM_ID
    )}')
  );


  INSERT INTO "FulfillmentService" (id, "sessionId", "shopifyFulfillmentServiceId", "shopifyLocationId")
  VALUES (
    '${uuidv4()}',
    '${DEFAULT_ITEMS.RETAILER_SESSION_ID}',
    '${DEFAULT_ITEMS.RETAILER_SHOPIFY_FULFILLMENT_SERVICE_ID}',
    '${DEFAULT_ITEMS.RETAILER_SHOPIFY_LOCATION_ID}'
  );
  COMMIT;
`;
