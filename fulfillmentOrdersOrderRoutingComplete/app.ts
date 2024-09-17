/* eslint-disable @typescript-eslint/no-explicit-any */
import { APIGatewayProxyResult } from 'aws-lambda';
import { Pool, PoolClient } from 'pg';
import {
    FULFILLMENT_ORDER_SPLIT_MUTATION,
    GET_FULFILLMENT_ORDER_LOCATION,
    GET_INITIAL_FULFILLMENT_ORDER_LINE_ITEMS,
    GET_SUBSEQUENT_FULFILLMENT_ORDER_LINE_ITEMS,
} from './graphql';
import {
    FulfillmentOrderLocationQuery,
    FulfillmentOrderSplitMutation,
    InitialFulfillmentOrderDetailsQuery,
    SubsequentFulfillmentOrderDetailsQuery,
} from './types/admin.generated';
import { fetchAndValidateGraphQLData, mutateAndValidateGraphQLData } from './util';

type Event = {
    version: string;
    id: string;
    'detail-type': string;
    source: string;
    account: string;
    time: string;
    region: string;
    resources: [];
    detail: {
        'X-Shopify-Topic': string;
        'X-Shopify-Hmac-Sha256': string;
        'X-Shopify-Shop-Domain': string;
        'X-Shopify-Webhook-Id': string;
        'X-Shopify-Triggered-At': string;
        'X-Shopify-Event-Id': string;
        payload: {
            fulfillment_order: {
                id: string;
                status: string;
            };
        };
    };
};

type OrderLineDetail = {
    fulfillmentOrderLineItemId: string;
    fulfillmentOrderLineItemQuantity: number;
    shopifyVariantId: string;
};

type FulfillmentOrderDetails = {
    fulfillmentOrderId: string;
    orderLineDetails: OrderLineDetail[];
};

type OrderLineDetailWithFulfillmentOrderId = {
    fulfillmentOrderId: string;
} & OrderLineDetail;

type FulfillmentOrderForRetailer = {
    supplierId: string;
    fulfillmentOrderId: string;
    orderLineDetails: OrderLineDetail[];
};

let pool: Pool | null = null;

async function initializePool() {
    if (!pool) {
        // https://stackoverflow.com/questions/76899023/rds-while-connection-error-no-pg-hba-conf-entry-for-host
        pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DATABASE,
            password: process.env.DB_PASSWORD,
            port: Number(process.env.DB_PORT) ?? 5432,
            max: 20,
            ssl: {
                rejectUnauthorized: false,
            },
        });
    }
    return pool;
}

async function getSession(shop: string, client: PoolClient) {
    const sessionQuery = `SELECT * FROM "Session" WHERE shop = $1 LIMIT 1`;
    const sessionData = await client.query(sessionQuery, [shop]);
    if (sessionData.rowCount === 0) {
        throw new Error('Shop data is invalid.');
    }
    const session = sessionData.rows[0];
    return session;
}

async function isAppFulfillmentLocation(
    shop: string,
    accessToken: string,
    sessionId: string,
    fulfillmentOrderId: string,
    client: PoolClient,
) {
    const locationQuery = (await fetchAndValidateGraphQLData(shop, accessToken, GET_FULFILLMENT_ORDER_LOCATION, {
        id: fulfillmentOrderId,
    })) as FulfillmentOrderLocationQuery;
    const locationId = locationQuery.fulfillmentOrder?.assignedLocation.location?.id ?? '';
    if (!locationId) {
        return false;
    }
    const fulfillmentServiceQuery = `
        SELECT id FROM "FulfillmentService" 
        WHERE "shopifyLocationId" = $1 
        AND "sessionId" = $2 
        LIMIT 1
    `;
    const fulfillmentService = await client.query(fulfillmentServiceQuery, [locationId, sessionId]);
    if (fulfillmentService && fulfillmentService.rows.length > 0) {
        return true;
    }
    return false;
}

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
        const data: SubsequentFulfillmentOrderDetailsQuery | InitialFulfillmentOrderDetailsQuery =
            await fetchAndValidateGraphQLData(shop, accessToken, query, variables);

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

async function splitFulfillmentOrderForRetailer(
    originalFulfillmentOrderId: string,
    shop: string,
    accessToken: string,
    client: PoolClient,
) {
    const orderLineDetails = await getAllOrderLineDetails(originalFulfillmentOrderId, shop, accessToken);
    const supplierIdToOrderLineDetails = new Map<string, OrderLineDetail[]>();
    const supplierIdToFulfillmentOrderDetails = new Map<string, FulfillmentOrderDetails>();

    orderLineDetails.forEach(async (lineDetail) => {
        const { shopifyVariantId: importedShopifyVariantId } = lineDetail;
        const supplierIdQuery = `
            SELECT "PriceList"."supplierId"
            FROM "ImportedVariant"
            LEFT JOIN "Variant" ON "ImportedVariant"."prismaVariantId" = "Variant"."id"
            LEFT JOIN "Product" ON "Variant"."productId" = "Product"."id"
            LEFT JOIN "PriceList" ON "Product"."priceListId" = "PriceList"."id"
            WHERE "ImportedVariant"."shopifyVariantId" = $1
            LIMIT 1
        `;
        const supplierId: string = (await client.query(supplierIdQuery, [importedShopifyVariantId])).rows[0]
            ?.supplierId;
        if (!supplierId) {
            throw new Error('Supplier Id was not found in order.');
        }
        supplierIdToOrderLineDetails.set(supplierId, [
            ...(supplierIdToOrderLineDetails.get(supplierId) || []),
            lineDetail,
        ]);
    });

    const supplierIds = Array.from(supplierIdToOrderLineDetails.keys());
    supplierIds.forEach(async (supplierId, index) => {
        const orderLineDetails = supplierIdToOrderLineDetails.get(supplierId);
        if (orderLineDetails === undefined) {
            throw new Error('Supplier id is invalid.');
        }
        // the original fulfillment order ID remains the same while everything else is split
        if (index == 0) {
            supplierIdToFulfillmentOrderDetails.set(supplierId, {
                fulfillmentOrderId: originalFulfillmentOrderId,
                orderLineDetails,
            });
        } else {
            const fulfillmentOrderSplitInput = {
                fulfillmentOrderId: originalFulfillmentOrderId,
                fulfillmentOrderLineItems: orderLineDetails.map((detail) => {
                    return {
                        id: detail.fulfillmentOrderLineItemId,
                        quantity: detail.fulfillmentOrderLineItemQuantity,
                    };
                }),
            };
            const splitFulfillmentOrderPayload: FulfillmentOrderSplitMutation = await mutateAndValidateGraphQLData(
                shop,
                accessToken,
                FULFILLMENT_ORDER_SPLIT_MUTATION,
                {
                    fulfillmentOrderSplits: fulfillmentOrderSplitInput,
                },
                'Failed to split fulfillment order',
            );
            const newFulfillmentOrderId =
                splitFulfillmentOrderPayload?.fulfillmentOrderSplit?.fulfillmentOrderSplits?.[0]
                    ?.remainingFulfillmentOrder?.id || null;
            if (!newFulfillmentOrderId) {
                throw new Error('New generated fulfillment order id is not valid');
            }
            supplierIdToFulfillmentOrderDetails.set(supplierId, {
                fulfillmentOrderId: newFulfillmentOrderId,
                orderLineDetails,
            });
        }
    });
    return supplierIdToFulfillmentOrderDetails;
}

async function createSupplierOrders(newFulfillmentOrders: Map<string, FulfillmentOrderDetails>) {
    return;
}

// TODO: Figure out how you want to store shipping rates / fulfillment details to remit later
// TODO: For now, focus on the logic to just split, the order, create the order for the suppliers
export const lambdaHandler = async (event: Event): Promise<APIGatewayProxyResult> => {
    let client: null | PoolClient = null;
    try {
        const pool = await initializePool();
        client = await pool.connect();
        const shop = event.detail['X-Shopify-Shop-Domain'];
        const fulfillmentOrderId = event.detail.payload.fulfillment_order.id;
        const session = await getSession(shop, client);
        const isInterestedLocation = await isAppFulfillmentLocation(
            shop,
            session.accessToken,
            session.id,
            fulfillmentOrderId,
            client,
        );
        if (!isInterestedLocation) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'This fulfillment order is not a SynqSell order.',
                }),
            };
        }
        const newFulfillmentOrders = await splitFulfillmentOrderForRetailer(
            fulfillmentOrderId,
            shop,
            session.accessToken,
            client,
        );
        await createSupplierOrders(newFulfillmentOrders);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully created fulfillment orders for supplier.',
            }),
        };
    } catch (err) {
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully created fulfillment orders for supplier.',
            }),
        };
    } finally {
        if (client) {
            client.release();
        }
    }
};
