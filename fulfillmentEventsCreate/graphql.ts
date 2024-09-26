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
      trackingInfo {
        company
        number
        url
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
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

// Shopify's docs say this is deprecated, but it's the only one that works with codgen...
export const CREATE_FULFILLMENT_FULFILLMENT_ORDER_MUTATION = `#graphql
  mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
    fulfillmentCreateV2(fulfillment: $fulfillment) {
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
