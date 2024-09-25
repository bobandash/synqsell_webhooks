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

type OrderLineDetail = {
    fulfillmentOrderLineItemId: string;
    fulfillmentOrderLineItemQuantity: number;
    shopifyVariantId: string;
};

type ImportedShopifyVariantIdToSupplierId = {
    importedShopifyVariantId: string;
    supplierId: string;
};

type OrderLinesBySupplier = Map<string, OrderLineDetail[]>; // string is supplierId

async function getAllOrderLineDetails(fulfillmentOrderId: string, shop: string, accessToken: string) {
    const orderLineDetails: OrderLineDetail[] = [];
    let hasNextPage = true;
    let isInitialFetch = true;
    let endCursor = '';
    do {
        const query = isInitialFetch
            ? GET_INITIAL_FULFILLMENT_ORDER_LINE_ITEMS
            : GET_SUBSEQUENT_FULFILLMENT_ORDER_LINE_ITEMS;
        const variables = isInitialFetch
            ? { variables: { id: fulfillmentOrderId } }
            : { variables: { id: fulfillmentOrderId, after: endCursor } };
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

async function getOrderLinesBySupplier(orderLineDetails: OrderLineDetail[], client: PoolClient) {
    const importedShopifyVariantIds = orderLineDetails.map(({ shopifyVariantId }) => shopifyVariantId);
    const importedShopifyVariantIdToSupplierIdQuery = `
        SELECT 
          "ImportedVariant"."shopifyVariantId" AS "importedShopifyVariantId",
          "PriceList"."supplierId" AS "supplierId"
        FROM "ImportedVariant"
        INNER JOIN "ImportedProduct" ON "ImportedProduct"."id" = "ImportedVariant"."importedProductId"
        INNER JOIN "Product" ON "Product"."id" = "ImportedProduct"."prismaProductId"
        INNER JOIN "PriceList" ON "PriceList"."id" = "Product"."priceListId"
        WHERE "ImportedVariant"."shopifyVariantId" = ANY($1)
      `;

    const res = await client.query(importedShopifyVariantIdToSupplierIdQuery, [importedShopifyVariantIds]);
    const data: ImportedShopifyVariantIdToSupplierId[] = res.rows;
    const importedShopifyVariantIdToSupplierIdMap = createMapIdToRestObj(data, 'importedShopifyVariantId');
    const supplierToOrderLineDetail = new Map<string, OrderLineDetail[]>();
    orderLineDetails.forEach((orderLine) => {
        const importedShopifyVariantId = orderLine.shopifyVariantId;
        const supplierId = importedShopifyVariantIdToSupplierIdMap.get(importedShopifyVariantId)?.supplierId;
        if (!supplierId) {
            throw new Error('No supplier exists for imported variant ' + importedShopifyVariantId);
        }
        const orderLineDetails = supplierToOrderLineDetail.get(supplierId) ?? ([] as OrderLineDetail[]);
        orderLineDetails.push(orderLine);
        supplierToOrderLineDetail.set(supplierId, orderLineDetails);
    });
    return supplierToOrderLineDetail;
}

async function splitFulfillmentOrderOnShopify(
    orderLinesBySupplier: OrderLinesBySupplier,
    shop: string,
    accessToken: string,
    originalFulfillmentOrderId: string,
) {
    const supplierIds = Array.from(orderLinesBySupplier.keys());

    // splitting fulfillment order inside the loop rather than using Promise.all
    // because shopify's API only returns id of fulfillment order and no ability to refetch line items
    // it's simpler to get the data in the correct format in the map itself
    const newFulfillmentOrders = supplierIds.map(async (supplierId, index) => {
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
                newFulfillmentOrder.fulfillmentOrderSplit?.fulfillmentOrderSplits?.[0]?.remainingFulfillmentOrder?.id ??
                '';
        }
        return {
            fulfillmentOrderId: fulfillmentOrderId,
            supplierId: supplierId,
            orderLineItems: orderLine.map((detail) => ({
                id: detail.fulfillmentOrderLineItemId,
                quantity: detail.fulfillmentOrderLineItemQuantity,
                shopifyVariantid: detail.shopifyVariantId,
            })),
        };
    });

    return newFulfillmentOrders;
}

async function splitFulfillmentOrderBySupplier(
    originalFulfillmentOrderId: string,
    shop: string,
    accessToken: string,
    client: PoolClient,
) {
    const orderLineDetails = await getAllOrderLineDetails(originalFulfillmentOrderId, shop, accessToken);
    const orderLinesBySupplier = await getOrderLinesBySupplier(orderLineDetails, client);
    const newShopifyFulfillmentOrders = await splitFulfillmentOrderOnShopify(
        orderLinesBySupplier,
        shop,
        accessToken,
        originalFulfillmentOrderId,
    );
    return newShopifyFulfillmentOrders;
}

export default splitFulfillmentOrderBySupplier;
