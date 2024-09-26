import { PoolClient } from 'pg';
import {
    FULFILLMENT_ORDER_SPLIT_MUTATION,
    GET_INITIAL_FULFILLMENT_ORDER_LINE_ITEMS,
    GET_SUBSEQUENT_FULFILLMENT_ORDER_LINE_ITEMS,
} from '../graphql';
import { fetchAndValidateGraphQLData, mutateAndValidateGraphQLData } from '../util';
import {
    FulfillmentOrderSplitMutation,
    InitialFulfillmentOrderDetailsQuery,
    SubsequentFulfillmentOrderDetailsQuery,
} from '../types/admin.generated';
import createMapIdToRestObj from '../util/createMapToRestObj';
import { FulfillmentOrdersBySupplier } from '../types';

type OrderLineDetail = {
    fulfillmentOrderLineItemId: string;
    fulfillmentOrderLineItemQuantity: number;
    shopifyVariantId: string;
};

type OrderLineDetailWithPriceList = OrderLineDetail & { priceListId: string };

type ImportedVariantIdDetails = {
    importedShopifyVariantId: string;
    supplierId: string;
    priceListId: string;
};

type OrderLinesBySupplier = Map<string, OrderLineDetailWithPriceList[]>; // string is supplierId

async function getAllOrderLineDetails(fulfillmentOrderId: string, shop: string, accessToken: string) {
    const orderLineDetails: OrderLineDetail[] = [];
    let hasNextPage = true;
    let isInitialFetch = true;
    let endCursor = '';
    do {
        const query = isInitialFetch
            ? GET_INITIAL_FULFILLMENT_ORDER_LINE_ITEMS
            : GET_SUBSEQUENT_FULFILLMENT_ORDER_LINE_ITEMS;
        const variables = isInitialFetch ? { id: fulfillmentOrderId } : { id: fulfillmentOrderId, after: endCursor };
        const data = await fetchAndValidateGraphQLData<
            SubsequentFulfillmentOrderDetailsQuery | InitialFulfillmentOrderDetailsQuery
        >(shop, accessToken, query, variables);
        const edgesData = Object.values(data)[0];
        if (edgesData) {
            edgesData.lineItems.edges.forEach(({ node }) => {
                orderLineDetails.push({
                    fulfillmentOrderLineItemId: node.id,
                    fulfillmentOrderLineItemQuantity: node.totalQuantity,
                    shopifyVariantId: node.variant?.id ?? '',
                });
            });
            hasNextPage = edgesData.lineItems.pageInfo.hasNextPage;
            endCursor = edgesData.lineItems.pageInfo.endCursor ?? '';
        } else {
            hasNextPage = false;
        }
        isInitialFetch = false;
    } while (hasNextPage);
    return orderLineDetails;
}

async function getOrderLinesWithPriceListBySupplier(
    orderLineDetails: OrderLineDetail[],
    client: PoolClient,
): Promise<Map<string, OrderLineDetailWithPriceList[]>> {
    const importedShopifyVariantIds = orderLineDetails.map(({ shopifyVariantId }) => shopifyVariantId);
    const importedShopifyVariantIdToSupplierIdQuery = `
        SELECT 
          "ImportedVariant"."shopifyVariantId" AS "importedShopifyVariantId",
          "PriceList"."supplierId" AS "supplierId",
          "PriceList"."id" AS "priceListId"
        FROM "ImportedVariant"
        INNER JOIN "ImportedProduct" ON "ImportedProduct"."id" = "ImportedVariant"."importedProductId"
        INNER JOIN "Product" ON "Product"."id" = "ImportedProduct"."prismaProductId"
        INNER JOIN "PriceList" ON "PriceList"."id" = "Product"."priceListId"
        WHERE "ImportedVariant"."shopifyVariantId" = ANY($1)
      `;

    const res = await client.query(importedShopifyVariantIdToSupplierIdQuery, [importedShopifyVariantIds]);
    const data: ImportedVariantIdDetails[] = res.rows;
    const importedShopifyVariantIdDetailsMap = createMapIdToRestObj(data, 'importedShopifyVariantId');
    const supplierToOrderLineDetailWithPriceList = new Map<string, OrderLineDetailWithPriceList[]>();

    orderLineDetails.forEach((orderLine) => {
        const importedShopifyVariantId = orderLine.shopifyVariantId;
        const variantDetails = importedShopifyVariantIdDetailsMap.get(importedShopifyVariantId);
        if (!variantDetails) {
            throw new Error(`Variant id ${importedShopifyVariantId} has no price list or supplierId`);
        }
        const { priceListId, supplierId } = variantDetails;
        const orderLineDetails =
            supplierToOrderLineDetailWithPriceList.get(supplierId) ?? ([] as OrderLineDetailWithPriceList[]);
        orderLineDetails.push({ ...orderLine, priceListId });
        supplierToOrderLineDetailWithPriceList.set(supplierId, orderLineDetails);
    });
    return supplierToOrderLineDetailWithPriceList;
}

async function splitFulfillmentOrderOnShopify(
    orderLinesBySupplier: OrderLinesBySupplier,
    shop: string,
    accessToken: string,
    originalFulfillmentOrderId: string,
): Promise<FulfillmentOrdersBySupplier[]> {
    const supplierIds = Array.from(orderLinesBySupplier.keys());
    // splitting fulfillment order inside the loop rather than using Promise.all
    // because shopify's API only returns id of fulfillment order and no ability to refetch line items
    // it's simpler to get the data in the correct format in the map itself
    const newFulfillmentOrders = await Promise.all(
        supplierIds.map(async (supplierId, index) => {
            const orderLine = orderLinesBySupplier.get(supplierId);
            if (!orderLine) {
                throw new Error('Order line does not exist for supplier ' + supplierId); // this should never run, just for typescript
            }
            let fulfillmentOrderId = '';
            if (index === 0) {
                fulfillmentOrderId = originalFulfillmentOrderId;
            } else {
                const input = {
                    fulfillmentOrderId: originalFulfillmentOrderId,
                    fulfillmentOrderLineItems: orderLine.map((detail) => ({
                        id: detail.fulfillmentOrderLineItemId,
                        quantity: detail.fulfillmentOrderLineItemQuantity,
                    })),
                };
                const newFulfillmentOrder = await mutateAndValidateGraphQLData<FulfillmentOrderSplitMutation>(
                    shop,
                    accessToken,
                    FULFILLMENT_ORDER_SPLIT_MUTATION,
                    {
                        fulfillmentOrderSplits: input,
                    },
                    'Failed to split fulfillment order.',
                );
                fulfillmentOrderId =
                    newFulfillmentOrder.fulfillmentOrderSplit?.fulfillmentOrderSplits?.[0]?.remainingFulfillmentOrder
                        ?.id ?? '';
            }
            return {
                fulfillmentOrderId,
                supplierId,
                orderLineItems: orderLine.map((detail) => ({
                    shopifyLineItemId: detail.fulfillmentOrderLineItemId,
                    quantity: detail.fulfillmentOrderLineItemQuantity,
                    shopifyVariantId: detail.shopifyVariantId,
                    priceListId: detail.priceListId,
                })),
            };
        }),
    );

    return newFulfillmentOrders;
}

async function splitFulfillmentOrderBySupplier(
    originalFulfillmentOrderId: string,
    shop: string,
    accessToken: string,
    client: PoolClient,
) {
    const orderLineDetails = await getAllOrderLineDetails(originalFulfillmentOrderId, shop, accessToken);
    const orderLinesBySupplier = await getOrderLinesWithPriceListBySupplier(orderLineDetails, client);
    const newShopifyFulfillmentOrders = await splitFulfillmentOrderOnShopify(
        orderLinesBySupplier,
        shop,
        accessToken,
        originalFulfillmentOrderId,
    );
    return newShopifyFulfillmentOrders;
}

export default splitFulfillmentOrderBySupplier;
