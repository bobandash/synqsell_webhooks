export const DELETE_PRODUCT_MUTATION = `#graphql 
  mutation productDeleteMutation($id: ID!) {
    productDelete(input: {id: $id}) {
      deletedProductId
      userErrors {
        field
        message
      }
    }
  }
`;
