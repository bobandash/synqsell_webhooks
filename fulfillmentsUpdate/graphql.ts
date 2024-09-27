export const CANCEL_FULFILLMENT_MUTATION = `#graphql
  mutation fulfillmentCancel($id: ID!) {
    fulfillmentCancel(id: $id) {
      fulfillment {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;
