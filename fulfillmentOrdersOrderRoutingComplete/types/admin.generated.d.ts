/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types';

export type FulfillmentOrderLocationQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type FulfillmentOrderLocationQuery = { fulfillmentOrder?: AdminTypes.Maybe<{ assignedLocation: { location?: AdminTypes.Maybe<Pick<AdminTypes.Location, 'id'>> } }> };

export type InitialFulfillmentOrderDetailsQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type InitialFulfillmentOrderDetailsQuery = { fulfillmentOrder?: AdminTypes.Maybe<{ lineItems: { edges: Array<{ node: (
          Pick<AdminTypes.FulfillmentOrderLineItem, 'id' | 'totalQuantity'>
          & { variant?: AdminTypes.Maybe<Pick<AdminTypes.ProductVariant, 'id'>> }
        ) }>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> } }> };

export type SubsequentFulfillmentOrderDetailsQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  after: AdminTypes.Scalars['String']['input'];
}>;


export type SubsequentFulfillmentOrderDetailsQuery = { fulfillmentOrder?: AdminTypes.Maybe<{ lineItems: { edges: Array<{ node: (
          Pick<AdminTypes.FulfillmentOrderLineItem, 'id' | 'totalQuantity'>
          & { variant?: AdminTypes.Maybe<Pick<AdminTypes.ProductVariant, 'id'>> }
        ) }>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> } }> };

export type FulfillmentOrderSplitMutationVariables = AdminTypes.Exact<{
  fulfillmentOrderSplits: Array<AdminTypes.FulfillmentOrderSplitInput> | AdminTypes.FulfillmentOrderSplitInput;
}>;


export type FulfillmentOrderSplitMutation = { fulfillmentOrderSplit?: AdminTypes.Maybe<{ fulfillmentOrderSplits?: AdminTypes.Maybe<Array<{ remainingFulfillmentOrder: Pick<AdminTypes.FulfillmentOrder, 'id'> }>>, userErrors: Array<Pick<AdminTypes.FulfillmentOrderSplitUserError, 'field' | 'message'>> }> };

interface GeneratedQueryTypes {
  "#graphql \n    query fulfillmentOrderLocation($id: ID!) {\n        fulfillmentOrder(id: $id) {\n            assignedLocation {\n                location {\n                    id\n                }\n            }\n        }\n    }\n": {return: FulfillmentOrderLocationQuery, variables: FulfillmentOrderLocationQueryVariables},
  "#graphql\n    query initialFulfillmentOrderDetails($id: ID!) {\n        fulfillmentOrder(id: $id) {\n            lineItems(first: 10) {\n                edges {\n                  node {\n                    id\n                    variant {\n                        id\n                    }\n                    totalQuantity\n                  }\n                }\n                pageInfo {\n                  hasNextPage\n                  endCursor\n                }\n            },\n        }\n    }\n": {return: InitialFulfillmentOrderDetailsQuery, variables: InitialFulfillmentOrderDetailsQueryVariables},
  "#graphql\n    query subsequentFulfillmentOrderDetails($id: ID!, $after: String!) {\n        fulfillmentOrder(id: $id) {\n            lineItems(after: $after, first: 10) {\n                edges {\n                  node {\n                    id\n                    variant {\n                        id\n                    }\n                    totalQuantity\n                  }\n                }\n                pageInfo {\n                  hasNextPage\n                  endCursor\n                }\n            },\n        }\n    }\n": {return: SubsequentFulfillmentOrderDetailsQuery, variables: SubsequentFulfillmentOrderDetailsQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation fulfillmentOrderSplit($fulfillmentOrderSplits: [FulfillmentOrderSplitInput!]!) {\n    fulfillmentOrderSplit(fulfillmentOrderSplits: $fulfillmentOrderSplits) {\n      fulfillmentOrderSplits {\n        remainingFulfillmentOrder {\n          id\n        }\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: FulfillmentOrderSplitMutation, variables: FulfillmentOrderSplitMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
