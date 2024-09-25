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

export const GET_FULFILLMENT_ORDER_CUSTOMER_DETAILS = `#graphql 
  query fulfillmentOrderCustomerDetails($id: ID!){
    fulfillmentOrder(id:$id){
      destination{
        address1
        address2
        city
        company
        countryCode
        email
        firstName
        lastName
        phone
        province
        zip
      }
    }
  }
`;

export const DRAFT_ORDER_CREATE_MUTATION = `#graphql 
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
      }
    }
  }

`;

export const DRAFT_ORDER_COMPLETE_MUTATION = `#graphql 
  mutation draftOrderComplete($id: ID!) {
    draftOrderComplete(id: $id) {
      draftOrder {
        id
        order {
          id
        }
      }
    }
  }
`;
