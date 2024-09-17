export const GET_FULFILLMENT_ORDER_LOCATION = `#graphql 
    query fulfillmentOrderLocation($id: ID!) {
        fulfillmentOrder(id: $id) {
            assignedLocation {
                location {
                    id
                }
            }
        }
    }
`;

export const GET_INITIAL_FULFILLMENT_ORDER_LINE_ITEMS = `#graphql
    query initialFulfillmentOrderDetails($id: ID!) {
        fulfillmentOrder(id: $id) {
            lineItems(first: 10) {
                edges {
                  node {
                    id
                    variant {
                        id
                    }
                    totalQuantity
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
            },
        }
    }
`;

export const GET_SUBSEQUENT_FULFILLMENT_ORDER_LINE_ITEMS = `#graphql
    query subsequentFulfillmentOrderDetails($id: ID!, $after: String!) {
        fulfillmentOrder(id: $id) {
            lineItems(after: $after, first: 10) {
                edges {
                  node {
                    id
                    variant {
                        id
                    }
                    totalQuantity
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
            },
        }
    }
`;

export const FULFILLMENT_ORDER_SPLIT_MUTATION = `#graphql
  mutation fulfillmentOrderSplit($fulfillmentOrderSplits: [FulfillmentOrderSplitInput!]!) {
    fulfillmentOrderSplit(fulfillmentOrderSplits: $fulfillmentOrderSplits) {
      fulfillmentOrderSplits {
        remainingFulfillmentOrder {
          id
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;
