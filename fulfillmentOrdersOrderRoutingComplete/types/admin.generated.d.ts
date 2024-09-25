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

export type FulfillmentOrderCustomerDetailsQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type FulfillmentOrderCustomerDetailsQuery = { fulfillmentOrder?: AdminTypes.Maybe<{ destination?: AdminTypes.Maybe<Pick<AdminTypes.FulfillmentOrderDestination, 'address1' | 'address2' | 'city' | 'company' | 'countryCode' | 'email' | 'firstName' | 'lastName' | 'phone' | 'province' | 'zip'>> }> };

export type DraftOrderCreateMutationVariables = AdminTypes.Exact<{
  input: AdminTypes.DraftOrderInput;
}>;


export type DraftOrderCreateMutation = { draftOrderCreate?: AdminTypes.Maybe<{ draftOrder?: AdminTypes.Maybe<Pick<AdminTypes.DraftOrder, 'id'>> }> };

export type DraftOrderCompleteMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type DraftOrderCompleteMutation = { draftOrderComplete?: AdminTypes.Maybe<{ draftOrder?: AdminTypes.Maybe<(
      Pick<AdminTypes.DraftOrder, 'id'>
      & { order?: AdminTypes.Maybe<Pick<AdminTypes.Order, 'id'>> }
    )> }> };

export type InitialOrderDetailsQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type InitialOrderDetailsQuery = { order?: AdminTypes.Maybe<(
    Pick<AdminTypes.Order, 'presentmentCurrencyCode'>
    & { lineItems: { pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'>, edges: Array<{ node: (
          Pick<AdminTypes.LineItem, 'id' | 'quantity'>
          & { variant?: AdminTypes.Maybe<Pick<AdminTypes.ProductVariant, 'id'>> }
        ) }> }, shippingLine?: AdminTypes.Maybe<{ originalPriceSet: { presentmentMoney: Pick<AdminTypes.MoneyV2, 'amount' | 'currencyCode'> } }> }
  )> };

export type SubsequentOrderDetailsQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  after: AdminTypes.Scalars['String']['input'];
}>;


export type SubsequentOrderDetailsQuery = { order?: AdminTypes.Maybe<{ lineItems: { pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'>, edges: Array<{ node: (
          Pick<AdminTypes.LineItem, 'id' | 'quantity'>
          & { variant?: AdminTypes.Maybe<Pick<AdminTypes.ProductVariant, 'id'>> }
        ) }> } }> };

interface GeneratedQueryTypes {
  "#graphql \n    query fulfillmentOrderLocation($id: ID!) {\n        fulfillmentOrder(id: $id) {\n            assignedLocation {\n                location {\n                    id\n                }\n            }\n        }\n    }\n": {return: FulfillmentOrderLocationQuery, variables: FulfillmentOrderLocationQueryVariables},
  "#graphql\n    query initialFulfillmentOrderDetails($id: ID!) {\n        fulfillmentOrder(id: $id) {\n            lineItems(first: 10) {\n                edges {\n                  node {\n                    id\n                    variant {\n                        id\n                    }\n                    totalQuantity\n                  }\n                }\n                pageInfo {\n                  hasNextPage\n                  endCursor\n                }\n            },\n        }\n    }\n": {return: InitialFulfillmentOrderDetailsQuery, variables: InitialFulfillmentOrderDetailsQueryVariables},
  "#graphql\n    query subsequentFulfillmentOrderDetails($id: ID!, $after: String!) {\n        fulfillmentOrder(id: $id) {\n            lineItems(after: $after, first: 10) {\n                edges {\n                  node {\n                    id\n                    variant {\n                        id\n                    }\n                    totalQuantity\n                  }\n                }\n                pageInfo {\n                  hasNextPage\n                  endCursor\n                }\n            },\n        }\n    }\n": {return: SubsequentFulfillmentOrderDetailsQuery, variables: SubsequentFulfillmentOrderDetailsQueryVariables},
  "#graphql \n  query fulfillmentOrderCustomerDetails($id: ID!){\n    fulfillmentOrder(id:$id){\n      destination{\n        address1\n        address2\n        city\n        company\n        countryCode\n        email\n        firstName\n        lastName\n        phone\n        province\n        zip\n      }\n    }\n  }\n": {return: FulfillmentOrderCustomerDetailsQuery, variables: FulfillmentOrderCustomerDetailsQueryVariables},
  "#graphql\n  query initialOrderDetails($id: ID!){\n    order(id: $id) {\n      lineItems(first:10){\n      pageInfo{\n        hasNextPage\n        endCursor\n      }\n      edges {\n        node{\n          id\n          variant {\n            id\n          }\n          quantity\n        }\n      }\n    }\n    presentmentCurrencyCode\n    shippingLine {\n      originalPriceSet{\n        presentmentMoney {\n          amount\n          currencyCode\n        }\n      }\n    }}\n  }\n": {return: InitialOrderDetailsQuery, variables: InitialOrderDetailsQueryVariables},
  "#graphql \n  query subsequentOrderDetails($id: ID!, $after: String!){\n    order(id: $id){\n      lineItems(after: $after, first: 10){\n        pageInfo{\n          hasNextPage\n          endCursor\n        }\n        edges {\n          node{\n            id\n            variant {\n              id\n            }\n            quantity\n          }\n        }\n      }\n    }\n  }\n": {return: SubsequentOrderDetailsQuery, variables: SubsequentOrderDetailsQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation fulfillmentOrderSplit($fulfillmentOrderSplits: [FulfillmentOrderSplitInput!]!) {\n    fulfillmentOrderSplit(fulfillmentOrderSplits: $fulfillmentOrderSplits) {\n      fulfillmentOrderSplits {\n        remainingFulfillmentOrder {\n          id\n        }\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: FulfillmentOrderSplitMutation, variables: FulfillmentOrderSplitMutationVariables},
  "#graphql \n  mutation draftOrderCreate($input: DraftOrderInput!) {\n    draftOrderCreate(input: $input) {\n      draftOrder {\n        id\n      }\n    }\n  }\n\n": {return: DraftOrderCreateMutation, variables: DraftOrderCreateMutationVariables},
  "#graphql \n  mutation draftOrderComplete($id: ID!) {\n    draftOrderComplete(id: $id) {\n      draftOrder {\n        id\n        order {\n          id\n        }\n      }\n    }\n  }\n": {return: DraftOrderCompleteMutation, variables: DraftOrderCompleteMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
