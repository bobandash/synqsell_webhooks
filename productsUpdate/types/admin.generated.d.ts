/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types';

export type ProductVariantsBulkUpdateMutationVariables = AdminTypes.Exact<{
  productId: AdminTypes.Scalars['ID']['input'];
  variants: Array<AdminTypes.ProductVariantsBulkInput> | AdminTypes.ProductVariantsBulkInput;
}>;


export type ProductVariantsBulkUpdateMutation = { productVariantsBulkUpdate?: AdminTypes.Maybe<{ product?: AdminTypes.Maybe<Pick<AdminTypes.Product, 'id'>> }> };

export type ProductVariantInfoQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type ProductVariantInfoQuery = { productVariant?: AdminTypes.Maybe<Pick<AdminTypes.ProductVariant, 'id' | 'price' | 'inventoryQuantity'>> };

export type InventorySetQuantitiesMutationVariables = AdminTypes.Exact<{
  input: AdminTypes.InventorySetQuantitiesInput;
}>;


export type InventorySetQuantitiesMutation = { inventorySetQuantities?: AdminTypes.Maybe<{ inventoryAdjustmentGroup?: AdminTypes.Maybe<(
      Pick<AdminTypes.InventoryAdjustmentGroup, 'reason' | 'referenceDocumentUri'>
      & { changes: Array<Pick<AdminTypes.InventoryChange, 'name' | 'delta' | 'quantityAfterChange'>> }
    )>, userErrors: Array<Pick<AdminTypes.InventorySetQuantitiesUserError, 'code' | 'field' | 'message'>> }> };

interface GeneratedQueryTypes {
  "#graphql\n  query ProductVariantInfo($id: ID!) {\n    productVariant(id: $id) {\n      id\n      price\n      inventoryQuantity\n    }\n  }\n": {return: ProductVariantInfoQuery, variables: ProductVariantInfoQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {\n    productVariantsBulkUpdate(productId: $productId, variants: $variants) {\n      product {\n        id\n      }\n    }\n  }\n": {return: ProductVariantsBulkUpdateMutation, variables: ProductVariantsBulkUpdateMutationVariables},
  "#graphql \n  mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {\n    inventorySetQuantities(input: $input) {\n      inventoryAdjustmentGroup {\n        reason\n        referenceDocumentUri\n        changes {\n          name\n          delta\n          quantityAfterChange\n        }\n      }\n      userErrors {\n        code\n        field\n        message\n      }\n    }\n  }\n": {return: InventorySetQuantitiesMutation, variables: InventorySetQuantitiesMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
