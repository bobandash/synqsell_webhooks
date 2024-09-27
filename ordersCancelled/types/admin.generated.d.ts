/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types';

export type FulfillmentOrderCancelMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type FulfillmentOrderCancelMutation = { fulfillmentOrderCancel?: AdminTypes.Maybe<{ fulfillmentOrder?: AdminTypes.Maybe<Pick<AdminTypes.FulfillmentOrder, 'id' | 'status' | 'requestStatus'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

interface GeneratedQueryTypes {
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation fulfillmentOrderCancel($id: ID!) {\n    fulfillmentOrderCancel(id: $id) {\n      fulfillmentOrder {\n        id\n        status\n        requestStatus\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: FulfillmentOrderCancelMutation, variables: FulfillmentOrderCancelMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
