/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types';

export type FulfillmentDetailsQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type FulfillmentDetailsQuery = { fulfillment?: AdminTypes.Maybe<{ fulfillmentLineItems: { edges: Array<{ node: (
          Pick<AdminTypes.FulfillmentLineItem, 'quantity'>
          & { lineItem: Pick<AdminTypes.LineItem, 'id'> }
        ) }>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> }, trackingInfo: Array<Pick<AdminTypes.FulfillmentTrackingInfo, 'company' | 'number' | 'url'>> }> };

export type SubsequentFulfillmentDetailsQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  after: AdminTypes.Scalars['String']['input'];
}>;


export type SubsequentFulfillmentDetailsQuery = { fulfillment?: AdminTypes.Maybe<{ fulfillmentLineItems: { edges: Array<{ node: (
          Pick<AdminTypes.FulfillmentLineItem, 'quantity'>
          & { lineItem: Pick<AdminTypes.LineItem, 'id'> }
        ) }>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> } }> };

export type FulfillmentCreateV2MutationVariables = AdminTypes.Exact<{
  fulfillment: AdminTypes.FulfillmentV2Input;
}>;


export type FulfillmentCreateV2Mutation = { fulfillmentCreateV2?: AdminTypes.Maybe<{ fulfillment?: AdminTypes.Maybe<Pick<AdminTypes.Fulfillment, 'id' | 'status'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

interface GeneratedQueryTypes {
  "#graphql \n  query fulfillmentDetails($id: ID!) {\n    fulfillment(id: $id) {\n      fulfillmentLineItems(first: 10) {\n        edges {\n          node {\n            lineItem {\n              id\n            }\n            quantity\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n      }\n      trackingInfo {\n        company\n        number\n        url\n      }\n    }\n  }\n": {return: FulfillmentDetailsQuery, variables: FulfillmentDetailsQueryVariables},
  "#graphql \n  query subsequentFulfillmentDetails($id: ID!, $after: String!) {\n    fulfillment(id: $id) {\n      fulfillmentLineItems(first: 10, after: $after) {\n        edges {\n          node {\n            lineItem {\n              id\n            }\n            quantity\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n      }\n    }\n  }\n": {return: SubsequentFulfillmentDetailsQuery, variables: SubsequentFulfillmentDetailsQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {\n    fulfillmentCreateV2(fulfillment: $fulfillment) {\n      fulfillment {\n        id\n        status\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: FulfillmentCreateV2Mutation, variables: FulfillmentCreateV2MutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
