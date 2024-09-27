export const CANCEL_ORDER_MUTATION = `#graphql
  mutation orderCancel($orderId: ID!, $reason: OrderCancelReason!, $refund: Boolean!, $restock: Boolean!) {
    orderCancel(orderId: $orderId, reason: $reason, refund: $refund, restock: $restock) {
      job {
        id
      }
      orderCancelUserErrors {
        message
      }
      userErrors {
        field
        message
      }
    }
  }
`;
