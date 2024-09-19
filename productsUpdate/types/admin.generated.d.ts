/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types';

export type ProductVariantsBulkUpdateMutationVariables = AdminTypes.Exact<{
  productId: AdminTypes.Scalars['ID']['input'];
  variants: Array<AdminTypes.ProductVariantsBulkInput> | AdminTypes.ProductVariantsBulkInput;
}>;


export type ProductVariantsBulkUpdateMutation = { productVariantsBulkUpdate?: AdminTypes.Maybe<{ product?: AdminTypes.Maybe<Pick<AdminTypes.Product, 'id'>>, productVariants?: AdminTypes.Maybe<Array<(
      Pick<AdminTypes.ProductVariant, 'id'>
      & { metafields: { edges: Array<{ node: Pick<AdminTypes.Metafield, 'namespace' | 'key' | 'value'> }> } }
    )>>, userErrors: Array<Pick<AdminTypes.ProductVariantsBulkUpdateUserError, 'field' | 'message'>> }> };

export type ProductVariantInfoQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type ProductVariantInfoQuery = { productVariant?: AdminTypes.Maybe<Pick<AdminTypes.ProductVariant, 'id' | 'price' | 'inventoryQuantity'>> };

interface GeneratedQueryTypes {
  "#graphql\n  query ProductVariantInfo($id: ID!) {\n    productVariant(id: $id) {\n      id\n      price\n      inventoryQuantity\n    }\n  }\n": {return: ProductVariantInfoQuery, variables: ProductVariantInfoQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {\n    productVariantsBulkUpdate(productId: $productId, variants: $variants) {\n      product {\n        id\n      }\n      productVariants {\n        id\n        metafields(first: 2) {\n          edges {\n            node {\n              namespace\n              key\n              value\n            }\n          }\n        }\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: ProductVariantsBulkUpdateMutation, variables: ProductVariantsBulkUpdateMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
