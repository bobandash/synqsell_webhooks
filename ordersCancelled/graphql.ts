export const CANCEL_FULFILLMENT_ORDER_MUTATION = `#graphql
  mutation fulfillmentOrderCancel($id: ID!) {
    fulfillmentOrderCancel(id: $id) {
      fulfillmentOrder {
        id
        status
        requestStatus
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const GET_ORDER_ID = `#graphql
  query fulfillmentOrder($id: ID!){
    fulfillmentOrder(id: $id){
      orderId
    }
  }
`;

export const CREATE_REFUND_MUTATION = `#graphql 
  mutation M($input: RefundInput!) {
    refundCreate(input: $input) {
      userErrors {
        field
        message
      }
      refund {
        id
        note
        totalRefundedSet {
          presentmentMoney {
            amount
          }
        }
      }
    }
  }
`;
