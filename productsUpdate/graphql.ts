export const PRODUCT_VARIANT_BULK_UPDATE_PRICE = `#graphql
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      product {
        id
      }
    }
  }
`;

export const PRODUCT_VARIANT_INFO = `#graphql
  query ProductVariantInfo($id: ID!) {
    productVariant(id: $id) {
      id
      price
      inventoryQuantity
    }
  }
`;

export const ADJUST_INVENTORY_MUTATION = `#graphql 
  mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      inventoryAdjustmentGroup {
        reason
        referenceDocumentUri
        changes {
          name
          delta
          quantityAfterChange
        }
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;
