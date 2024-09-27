/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types';

export type FulfillmentOrderCancelMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type FulfillmentOrderCancelMutation = { fulfillmentOrderCancel?: AdminTypes.Maybe<{ fulfillmentOrder?: AdminTypes.Maybe<Pick<AdminTypes.FulfillmentOrder, 'id' | 'status' | 'requestStatus'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type FulfillmentOrderQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type FulfillmentOrderQuery = { fulfillmentOrder?: AdminTypes.Maybe<Pick<AdminTypes.FulfillmentOrder, 'orderId'>> };

export type MMutationVariables = AdminTypes.Exact<{
  input: AdminTypes.RefundInput;
}>;


export type MMutation = { refundCreate?: AdminTypes.Maybe<{ userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>>, refund?: AdminTypes.Maybe<(
      Pick<AdminTypes.Refund, 'id' | 'note'>
      & { totalRefundedSet: { presentmentMoney: Pick<AdminTypes.MoneyV2, 'amount'> } }
    )> }> };

interface GeneratedQueryTypes {
  "#graphql\n  query fulfillmentOrder($id: ID!){\n    fulfillmentOrder(id: $id){\n      orderId\n    }\n  }\n": {return: FulfillmentOrderQuery, variables: FulfillmentOrderQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation fulfillmentOrderCancel($id: ID!) {\n    fulfillmentOrderCancel(id: $id) {\n      fulfillmentOrder {\n        id\n        status\n        requestStatus\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: FulfillmentOrderCancelMutation, variables: FulfillmentOrderCancelMutationVariables},
  "#graphql \n  mutation M($input: RefundInput!) {\n    refundCreate(input: $input) {\n      userErrors {\n        field\n        message\n      }\n      refund {\n        id\n        note\n        totalRefundedSet {\n          presentmentMoney {\n            amount\n          }\n        }\n      }\n    }\n  }\n": {return: MMutation, variables: MMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
