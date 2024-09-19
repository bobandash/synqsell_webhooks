export const PRODUCT_VARIANT_BULK_UPDATE = `#graphql
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      product {
        id
      }
      productVariants {
        id
        metafields(first: 2) {
          edges {
            node {
              namespace
              key
              value
            }
          }
        }
      }
      userErrors {
        field
        message
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
