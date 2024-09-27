import { PoolClient } from 'pg';
import { Session } from '../types';
import { fetchAndValidateGraphQLData, mutateAndValidateGraphQLData } from '../util';
import {
    FulfillmentCreateV2Mutation,
    FulfillmentDetailsQuery,
    SubsequentFulfillmentDetailsQuery,
} from '../types/admin.generated';
import {
    CREATE_FULFILLMENT_FULFILLMENT_ORDER_MUTATION,
    GET_FULFILLMENT_DETAILS,
    GET_SUBSEQUENT_FULFILLMENT_DETAILS,
} from '../graphql';
import createMapIdToRestObj from '../util/createMapToRestObj';
import { v4 as uuidv4 } from 'uuid';

type FulfillmentDetailLineItem = {
    shopifyLineItemId: string;
    quantity: number;
};

type TrackingInfo = {
    company: string;
    number: string;
    url: string;
};

type FulfillmentDetails = {
    trackingInfo: TrackingInfo[];
    lineItems: FulfillmentDetailLineItem[];
};

type SupplierAndRetailerOrderLineItem = {
    shopifyRetailerOrderLineItemId: string;
    shopifySupplierOrderLineItemId: string;
};

// ==============================================================================================================
// START: ADD FULFILLMENT DETAILS HELPER FUNCTIONS
// ==============================================================================================================

async function getRetailerSessionFromSupplierOrder(supplierShopifyOrderId: string, client: PoolClient) {
    try {
        const retailerSessionQuery = `
    SELECT "Session".* FROM "Order"
    INNER JOIN "Session" ON "Session"."id" = "Order"."retailerId" 
    WHERE "shopifySupplierOrderId" = $1
    LIMIT 1        
  `;
        const res = await client.query(retailerSessionQuery, [supplierShopifyOrderId]);
        if (res.rows.length === 0) {
            throw new Error('No retailer session exists for ' + supplierShopifyOrderId);
        }
        return res.rows[0] as Session;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to get retailer session from supplier order .' + supplierShopifyOrderId);
    }
}

async function getFulfillmentDetails(shopifyFulfillmentId: string, session: Session): Promise<FulfillmentDetails> {
    const fulfillmentDetailLineItems: FulfillmentDetailLineItem[] = [];

    const initialFulfillmentDetails = await fetchAndValidateGraphQLData<FulfillmentDetailsQuery>(
        session.shop,
        session.accessToken,
        GET_FULFILLMENT_DETAILS,
        {
            id: shopifyFulfillmentId,
        },
    );
    const initialPageInfo = initialFulfillmentDetails.fulfillment?.fulfillmentLineItems.pageInfo;
    const trackingInfo: TrackingInfo[] =
        initialFulfillmentDetails.fulfillment?.trackingInfo.map((tracking) => {
            return { company: tracking.company ?? '', number: tracking.number ?? '', url: tracking.url ?? '' };
        }) ?? [];

    initialFulfillmentDetails.fulfillment?.fulfillmentLineItems.edges.forEach(({ node }) => {
        fulfillmentDetailLineItems.push({
            shopifyLineItemId: node.lineItem.id,
            quantity: node.quantity ?? 0,
        });
    });

    let hasMore = initialPageInfo?.hasNextPage ?? false;
    let endCursor = initialPageInfo?.endCursor ?? null;

    while (hasMore && endCursor) {
        const subsequentFulfillmentDetails = await fetchAndValidateGraphQLData<SubsequentFulfillmentDetailsQuery>(
            session.shop,
            session.accessToken,
            GET_SUBSEQUENT_FULFILLMENT_DETAILS,
            {
                id: shopifyFulfillmentId,
                after: endCursor,
            },
        );
        const subsequentPageInfo = subsequentFulfillmentDetails.fulfillment?.fulfillmentLineItems.pageInfo;
        subsequentFulfillmentDetails.fulfillment?.fulfillmentLineItems.edges.forEach(({ node }) => {
            fulfillmentDetailLineItems.push({
                shopifyLineItemId: node.lineItem.id,
                quantity: node.quantity ?? 0,
            });
        });
        hasMore = subsequentPageInfo?.hasNextPage ?? false;
        endCursor = subsequentPageInfo?.endCursor ?? null;
    }

    const fulfillmentDetails = {
        trackingInfo: trackingInfo,
        lineItems: fulfillmentDetailLineItems,
    };

    return fulfillmentDetails;
}

async function getSupplierAndRetailerOrderLineItems(supplierShopifyOrderId: string, client: PoolClient) {
    try {
        const query = `
          SELECT 
            "OrderLineItem"."shopifyRetailerOrderLineItemId" AS "shopifyRetailerOrderLineItemId",
            "OrderLineItem"."shopifySupplierOrderLineItemId" AS "shopifySupplierOrderLineItemId"
          FROM "Order"
          INNER JOIN "OrderLineItem" ON "OrderLineItem"."orderId" = "Order"."id"
          WHERE "shopifySupplierOrderId" = $1
        `;
        const queryRes = await client.query(query, [supplierShopifyOrderId]);
        if (queryRes.rows.length === 0) {
            throw new Error('There are no order line items for ' + supplierShopifyOrderId);
        }

        return queryRes.rows as SupplierAndRetailerOrderLineItem[];
    } catch (error) {
        console.error(error);
        throw new Error('Failed to get supplier and retailer order line items from order id ' + supplierShopifyOrderId);
    }
}

async function getRetailerShopifyFulfillmentOrderId(supplierShopifyOrderId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "shopifyRetailerFulfillmentOrderId"
          FROM "Order"
          WHERE "shopifySupplierOrderId" = $1
          LIMIT 1
        `;
        const queryRes = await client.query(query, [supplierShopifyOrderId]);
        if (queryRes.rows.length === 0) {
            throw new Error('There is no retailer fulfillment order id for ' + supplierShopifyOrderId);
        }
        return queryRes.rows[0].shopifyRetailerFulfillmentOrderId as string;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to get retailer fulfillment order id from supplier order id ' + supplierShopifyOrderId);
    }
}

async function addRetailerFulfillmentOnShopify(
    supplierShopifyFulfillmentId: string,
    supplierSession: Session,
    retailerSession: Session,
    supplierShopifyOrderId: string,
    client: PoolClient,
) {
    const [supplierFulfillmentDetails, supplierAndRetailerOrderLineItems, retailerShopifyFulfillmentOrderId] =
        await Promise.all([
            getFulfillmentDetails(supplierShopifyFulfillmentId, supplierSession),
            getSupplierAndRetailerOrderLineItems(supplierShopifyOrderId, client),
            getRetailerShopifyFulfillmentOrderId(supplierShopifyOrderId, client),
        ]);
    const orderLineItemsIdMap = createMapIdToRestObj(
        supplierAndRetailerOrderLineItems,
        'shopifySupplierOrderLineItemId',
    ); // key = shopifySupplierOrderLineItemId, value = {shopifyRetailerOrderLineItemId: string}

    const { trackingInfo, lineItems } = supplierFulfillmentDetails;

    const fulfillmentCreateInput = {
        notifyCustomer: true,
        ...(trackingInfo.length > 1 && {
            trackingInfo: trackingInfo.reduce(
                (acc, tracking) => {
                    return {
                        company: tracking.company,
                        numbers: [...acc.numbers, tracking.number],
                        urls: [...acc.urls, tracking.url],
                    };
                },
                { company: '', numbers: [] as string[], urls: [] as string[] },
            ),
        }),
        lineItemsByFulfillmentOrder: {
            fulfillmentOrderId: retailerShopifyFulfillmentOrderId,
            fulfillmentOrderLineItems: lineItems.map(({ shopifyLineItemId, quantity }) => {
                const retailerFulfillmentOrderLineItemId =
                    orderLineItemsIdMap.get(shopifyLineItemId)?.shopifyRetailerOrderLineItemId;
                if (!retailerFulfillmentOrderLineItemId) {
                    throw new Error(
                        `Supplier line item id ${shopifyLineItemId} has no matching retailer fulfillment order line item.`,
                    );
                }
                return {
                    id: retailerFulfillmentOrderLineItemId,
                    quantity: quantity,
                };
            }),
        },
    };

    const matchingRetailerFulfillment = await mutateAndValidateGraphQLData<FulfillmentCreateV2Mutation>(
        retailerSession.shop,
        retailerSession.accessToken,
        CREATE_FULFILLMENT_FULFILLMENT_ORDER_MUTATION,
        {
            fulfillment: fulfillmentCreateInput,
        },
        'Failed to create fulfillment for retailer.',
    );

    const retailerFulfillmentId = matchingRetailerFulfillment.fulfillmentCreateV2?.fulfillment?.id ?? '';
    return retailerFulfillmentId;
}

async function getDbOrderId(supplierShopifyOrderId: string, client: PoolClient) {
    try {
        const orderQuery = `
            SELECT "id" FROM "Order"
            WHERE "shopifySupplierOrderId" = $1
            LIMIT 1        
        `;
        const orderRes = await client.query(orderQuery, [supplierShopifyOrderId]);
        if (orderRes.rows.length === 0) {
            throw new Error('There is no order id for shopify supplier order id ' + supplierShopifyOrderId);
        }

        return orderRes.rows[0].id as string;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to get database order id from supplier shopify order id ' + supplierShopifyOrderId);
    }
}

async function addFulfillmentToDatabase(
    supplierShopifyFulfillmentId: string,
    retailerShopifyFulfillmentId: string,
    dbOrderId: string,
    client: PoolClient,
) {
    try {
        const fulfillmentInsertionQuery = `
            INSERT INTO "Fulfillment" (
                "id",
                "supplierShopifyFulfillmentId",
                "retailerShopifyFulfillmentId",
                "orderId"
            )
            VALUES ( $1, $2, $3, $4 )
        `;

        await client.query(fulfillmentInsertionQuery, [
            uuidv4(),
            supplierShopifyFulfillmentId,
            retailerShopifyFulfillmentId,
            dbOrderId,
        ]);
    } catch (error) {
        console.error(error);
        throw new Error('Failed to add fulfillment in database.');
    }
}

// ==============================================================================================================
// END: ADD FULFILLMENT DETAILS HELPER FUNCTIONS
// ==============================================================================================================

async function createRetailerFulfillment(
    supplierShopifyFulfillmentId: string,
    supplierShopifyOrderId: string,
    supplierSession: Session,
    client: PoolClient,
) {
    const [retailerSession, dbOrderId] = await Promise.all([
        getRetailerSessionFromSupplierOrder(supplierShopifyOrderId, client),
        getDbOrderId(supplierShopifyOrderId, client),
    ]);
    const retailerShopifyFulfillmentId = await addRetailerFulfillmentOnShopify(
        supplierShopifyFulfillmentId,
        supplierSession,
        retailerSession,
        supplierShopifyOrderId,
        client,
    );

    await addFulfillmentToDatabase(supplierShopifyFulfillmentId, retailerShopifyFulfillmentId, dbOrderId, client);
}

export default createRetailerFulfillment;
