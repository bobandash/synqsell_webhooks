export const GET_FULFILLMENT_DETAILS = `#graphql 
  query fulfillmentDetails($id: ID!) {
    fulfillment(id: $id) {
      fulfillmentLineItems(first: 10) {
        edges {
          node {
            lineItem {
              id
            }
            quantity
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export const GET_SUBSEQUENT_FULFILLMENT_DETAILS = `#graphql 
  query subsequentFulfillmentDetails($id: ID!, $after: String!) {
    fulfillment(id: $id) {
      fulfillmentLineItems(first: 10, after: $after) {
        edges {
          node {
            lineItem {
              id
            }
            quantity
          }
        }
      }
    }
  }
`;

export const CREATE_FULFILLMENT_FULFILLMENT_ORDER_MUTATION = `#graphql
  mutation fulfillmentCreate($fulfillment: FulfillmentInput!) {
    fulfillmentCreate(fulfillment: $fulfillment) {
      fulfillment {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;
