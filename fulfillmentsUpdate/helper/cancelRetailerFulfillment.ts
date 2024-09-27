// case: supplier mistakenly bought incorrect tracking label, have to refund and update for the customer

import { PoolClient } from 'pg';
import { Session } from '../types';

// ==============================================================================================================
// START: CANCEL FULFILLMENT ON RETAILER STORE LOGIC
// ==============================================================================================================

async function getDbFulfillmentId(supplierShopifyFulfillmentId: string) {}

async function getDbOrderId(dbFulfillmentId: string) {
    return 'random number';
}

async function getRetailerShopifyFulfillmentId(dbFulfillmentId: string) {
    return "'";
}

async function getRetailerSession(dbOrderId: string) {
    return '' as Session;
}

async function removeRetailerFulfillmentShopify(
    retailerSession: Session,
    dbFulfillmentId: string,
    client: PoolClient,
) {}

async function removeFulfillmentDatabase(dbFulfillmentId: string, client: PoolClient) {}

// ==============================================================================================================
// START: END CANCEL FULFILLMENT ON RETAILER STORE LOGIC
// ==============================================================================================================

async function cancelRetailerFulfillment(supplierShopifyFulfillmentId: string, client: PoolClient) {
    const dbOrderId = await getDbOrderId(supplierShopifyFulfillmentId);
    const dbFulfillmentId = await getDbFulfillmentId(supplierShopifyFulfillmentId);
    const retailerShopifyFulfillmentId = await getRetailerShopifyFulfillmentId(supplierShopifyFulfillmentId);
    await removeFulfillmentDatabase(dbFulfillmentId, client);
}

export default cancelRetailerFulfillment;
