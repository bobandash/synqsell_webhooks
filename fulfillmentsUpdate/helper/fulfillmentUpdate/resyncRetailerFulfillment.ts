import { PoolClient } from 'pg';
import { PayloadLineItem, PayloadTrackingInfo, Session, ShopifyEvent } from '../../types';
import { mutateAndValidateGraphQLData } from '../../util';
import { FulfillmentCreateV2Mutation } from '../../types/admin.generated';
import { CREATE_FULFILLMENT_FULFILLMENT_ORDER_MUTATION } from '../../graphql';
import getSessionFromShop from '../util/getSessionFromShop';

// ==============================================================================================================
// START: RESYNC FULFILLMENT FOR RETAILER STORE LOGIC
// ==============================================================================================================
function getRelevantDetailsForResyncingRetailerFulfillment(payload: ShopifyEvent['detail']['payload']) {
    const lineItems = payload.line_items.map((lineItem) => ({
        id: lineItem.admin_graphql_api_id,
        quantity: lineItem.quantity,
    }));
    const trackingInfo = {
        company: payload.tracking_company,
        numbers: payload.tracking_numbers,
        urls: payload.tracking_urls,
    };

    return { lineItems, trackingInfo };
}

async function getDbFulfillmentId(retailerShopifyFulfillmentId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "id" FROM "Fulfillment"
          WHERE "retailerShopifyFulfillmentId" = $1
          LIMIT 1
        `;
        const res = await client.query(query, [retailerShopifyFulfillmentId]);
        if (res.rows.length === 0) {
            throw new Error(
                `No fulfillment row exists for retailerShopifyFulfillmentId ${retailerShopifyFulfillmentId}.`,
            );
        }
        return res.rows[0].id as string;
    } catch (error) {
        console.error(error);
        throw new Error(
            `Failed to retrieve database fulfillment id from retailerShopifyFulfillmentId ${retailerShopifyFulfillmentId}.`,
        );
    }
}

async function getShopifyRetailerFulfillmentOrderId(dbFulfillmentId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "shopifyRetailerFulfillmentOrderId" 
          FROM "Order" 
          WHERE "id" = (SELECT "orderId" FROM "Fulfillment" WHERE "id" = $1)
        `;
        const res = await client.query(query, [dbFulfillmentId]);
        if (res.rows.length === 0) {
            throw new Error(`No shopifyRetailerFulfillmentOrderId exists for dbFulfillmentId ${dbFulfillmentId}.`);
        }
        return res.rows[0].id as string;
    } catch (error) {
        console.error(error);
        throw new Error(
            `Failed to retrieve shopifyRetailerFulfillmentOrderId from dbFulfillmentId ${dbFulfillmentId}.`,
        );
    }
}

async function updateRetailerFulfillmentOnShopify(
    shopifyRetailerFulfillmentOrderId: string,
    lineItems: PayloadLineItem[],
    trackingInfo: PayloadTrackingInfo,
    retailerSession: Session,
) {
    const fulfillmentInput = {
        trackingInfo,
        lineItemsByFulfillmentOrder: {
            fulfillmentOrderId: shopifyRetailerFulfillmentOrderId,
            fulfillmentOrderLineItems: lineItems,
        },
    };

    const res = await mutateAndValidateGraphQLData<FulfillmentCreateV2Mutation>(
        retailerSession.shop,
        retailerSession.accessToken,
        CREATE_FULFILLMENT_FULFILLMENT_ORDER_MUTATION,
        { fulfillment: fulfillmentInput },
        "Failed to re-create fulfillment for retailer from supplier's data",
    );

    const newRetailerShopifyFulfillmentId = res.fulfillmentCreateV2?.fulfillment?.id;
    if (!newRetailerShopifyFulfillmentId) {
        throw new Error('No shopify fulfillment id was created from mutation.');
    } // this most likely will never run, just for type safety
    return newRetailerShopifyFulfillmentId;
}

async function updateFulfillmentInDatabase(
    dbFulfillmentId: string,
    newRetailerShopifyFulfillmentId: string,
    client: PoolClient,
) {
    try {
        const query = `
          UPDATE "Fulfillment"
          SET "retailerShopifyFulfillmentId" = $1
          WHERE "id" = $2
        `;
        await client.query(query, [newRetailerShopifyFulfillmentId, dbFulfillmentId]);
    } catch (error) {
        console.error(error);
        throw new Error(
            `Failed to update retailerShopifyFulfillmentId in database (fulfillment id: ${dbFulfillmentId}, retailerShopifyFulfillmentId: ${newRetailerShopifyFulfillmentId}).`,
        );
    }
}

// ==============================================================================================================
// START: RESYNC FULFILLMENT FOR RETAILER STORE LOGIC
// ==============================================================================================================

// if the retailer cancels the fulfillment of the order, then by default, it reads the supplier fulfillment and re-fulfills the order
// the supplier should be the single source of truth for fulfillments because the retailer doesn't handle this
// TODO: however, for refunds, we shouldn't handle until we receive more data on how people handle this issue
// because it doesn't make sense that if supplier ships the order, customer has a problem, retailer refunds customer and supplier is not paid
// and supplier doesn't know of this, then that's a big issue, so do not handle refunds for now; just cancellation and fulfillment
async function resyncRetailerFulfillment(
    retailerShopifyFulfillmentId: string,
    shop: string,
    payload: ShopifyEvent['detail']['payload'],
    client: PoolClient,
) {
    const { lineItems, trackingInfo } = getRelevantDetailsForResyncingRetailerFulfillment(payload);
    const [retailerSession, dbFulfillmentId] = await Promise.all([
        getSessionFromShop(shop, client),
        getDbFulfillmentId(retailerShopifyFulfillmentId, client),
    ]);
    const shopifyRetailerFulfillmentOrderId = await getShopifyRetailerFulfillmentOrderId(dbFulfillmentId, client);
    const newRetailerShopifyFulfillmentId = await updateRetailerFulfillmentOnShopify(
        shopifyRetailerFulfillmentOrderId,
        lineItems,
        trackingInfo,
        retailerSession,
    );
    await updateFulfillmentInDatabase(dbFulfillmentId, newRetailerShopifyFulfillmentId, client);
}

export default resyncRetailerFulfillment;
