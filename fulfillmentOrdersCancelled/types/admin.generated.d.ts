/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types';

export type OrderCancelMutationVariables = AdminTypes.Exact<{
  orderId: AdminTypes.Scalars['ID']['input'];
  reason: AdminTypes.OrderCancelReason;
  refund: AdminTypes.Scalars['Boolean']['input'];
  restock: AdminTypes.Scalars['Boolean']['input'];
}>;


export type OrderCancelMutation = { orderCancel?: AdminTypes.Maybe<{ job?: AdminTypes.Maybe<Pick<AdminTypes.Job, 'id'>>, orderCancelUserErrors: Array<Pick<AdminTypes.OrderCancelUserError, 'message'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

interface GeneratedQueryTypes {
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation orderCancel($orderId: ID!, $reason: OrderCancelReason!, $refund: Boolean!, $restock: Boolean!) {\n    orderCancel(orderId: $orderId, reason: $reason, refund: $refund, restock: $restock) {\n      job {\n        id\n      }\n      orderCancelUserErrors {\n        message\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: OrderCancelMutation, variables: OrderCancelMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
