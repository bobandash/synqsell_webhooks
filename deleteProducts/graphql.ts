const DELETE_PRODUCT_MUTATION = `#graphql 
  mutation productDeleteAsync($productId: ID!) {
    productDeleteAsync(productId: $productId) {
      deleteProductId
      userErrors {
        field
        message
      }
    }
  }
`;
