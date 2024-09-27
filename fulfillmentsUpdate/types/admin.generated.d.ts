/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types';

export type FulfillmentCancelMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type FulfillmentCancelMutation = { fulfillmentCancel?: AdminTypes.Maybe<{ fulfillment?: AdminTypes.Maybe<Pick<AdminTypes.Fulfillment, 'id' | 'status'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

interface GeneratedQueryTypes {
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation fulfillmentCancel($id: ID!) {\n    fulfillmentCancel(id: $id) {\n      fulfillment {\n        id\n        status\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: FulfillmentCancelMutation, variables: FulfillmentCancelMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
