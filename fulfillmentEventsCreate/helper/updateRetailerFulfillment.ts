import { PoolClient } from 'pg';

// ==============================================================================================================
// START: ADD FULFILLMENT DETAILS ON SHOPIFY FOR RETAILER
// ==============================================================================================================

async function addRetailerFulfillmentOnShopify(supplierShopifyFulfillmentId: string, supplierShopifyOrderId: string) {}

// ==============================================================================================================
// END: ADD FULFILLMENT DETAILS ON SHOPIFY FOR RETAILER
// ==============================================================================================================

async function updateRetailerFulfillment(
    supplierShopifyFulfillmentId: string,
    supplierShopifyOrderId: string,
    client: PoolClient,
) {
    await addRetailerFulfillmentOnShopify(supplierShopifyFulfillmentId, supplierShopifyOrderId);
}

// here's what needs to be coded
// check if order id is one that I need to care about
// get fulfillment id and get details
// update the retailer's order with fulfillment create
// store everything in the fulfillment database in case we need to cancel anything

export default updateRetailerFulfillment;
