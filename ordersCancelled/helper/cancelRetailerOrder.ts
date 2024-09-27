// for cancelling retailer order, are there any edge cases I really need to handle?
// supplier wants to be paid no matter what, so it should just broadcast the cancellation to the retailer's store and change payment status to cancelled
// depending on user feedback, we can change impl

import { PoolClient } from 'pg';
import { mutateAndValidateGraphQLData } from '../util';
import { FulfillmentOrderCancelMutation } from '../types/admin.generated';
import { Session } from '../types';
import { CANCEL_FULFILLMENT_ORDER_MUTATION } from '../graphql';
import { ORDER_PAYMENT_STATUS } from '../constants';

// ==============================================================================================================
// START: CANCEL FULFILLMENT ORDER ON RETAILER'S STORE LOGIC
// ==============================================================================================================

async function getOrderIdFromDatabase(supplierShopifyOrderId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "id" FROM "Order"
          WHERE "shopifySupplierOrderId" = $1
          LIMIT 1
        `;
        const queryRes = await client.query(query, [supplierShopifyOrderId]);
        if (queryRes.rows.length === 0) {
            throw new Error('No order exists for shopifySupplierOrderId ' + supplierShopifyOrderId);
        }

        return queryRes.rows[0].id as string;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to database order id for shopifySupplierOrderId ' + supplierShopifyOrderId);
    }
}

async function getRetailerShopifyFulfillmentOrderId(supplierShopifyOrderId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "shopifyRetailerFulfillmentOrderId" FROM "Order"
          WHERE "shopifySupplierOrderId" = $1
          LIMIT 1
        `;
        const queryRes = await client.query(query, [supplierShopifyOrderId]);
        if (queryRes.rows.length === 0) {
            throw new Error(
                'No shopifyRetailerFulfillmentOrderId exists for shopifySupplierOrderId ' + supplierShopifyOrderId,
            );
        }

        return queryRes.rows[0].shopifyRetailerFulfillmentOrderId as string;
    } catch (error) {
        console.error(error);
        throw new Error(
            'Failed to get shopifyRetailerFulfillmentOrderId from shopifySupplierOrderId ' + supplierShopifyOrderId,
        );
    }
}

async function getRetailerSession(shopifyFulfillmentOrderId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "Session".* FROM "Order"
          INNER JOIN "Session" ON "Order"."retailerId" = "Session"."id"
          WHERE "Order"."shopifyRetailerFulfillmentOrderId" = $1
          LIMIT 1
        `;
        const queryRes = await client.query(query, [shopifyFulfillmentOrderId]);
        if (queryRes.rows.length === 0) {
            throw new Error('No retailer session exists for shopifyFulfillmentOrderId ' + shopifyFulfillmentOrderId);
        }

        return queryRes.rows[0] as Session;
    } catch (error) {
        console.error(error);
        throw new Error(
            'Failed to retrieve retailer session from shopifyFulfillmentOrderId ' + shopifyFulfillmentOrderId,
        );
    }
}

async function cancelFulfillmentOrderOnShopify(shopifyFulfillmentOrderId: string, retailerSession: Session) {
    await mutateAndValidateGraphQLData<FulfillmentOrderCancelMutation>(
        retailerSession.shop,
        retailerSession.accessToken,
        CANCEL_FULFILLMENT_ORDER_MUTATION,
        {
            id: shopifyFulfillmentOrderId,
        },
        `Failed to cancel retailer's fulfillment order id ${shopifyFulfillmentOrderId}`,
    );
}

async function updateOrderStatusToCancelledOnDb(dbOrderId: string, client: PoolClient) {
    try {
        const updateQuery = `UPDATE "Order" SET "paymentStatus" = $1 WHERE id = $2`;
        await client.query(updateQuery, [ORDER_PAYMENT_STATUS.CANCELLED, dbOrderId]);
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to update order ${dbOrderId} to cancelled.`);
    }
}

// ==============================================================================================================
// END: CANCEL FULFILLMENT ORDER ON RETAILER'S STORE LOGIC
// ==============================================================================================================

async function cancelRetailerOrder(supplierShopifyOrderId: string, client: PoolClient) {
    const dbOrderId = await getOrderIdFromDatabase(supplierShopifyOrderId, client);
    const retailerShopifyFulfillmentOrderId = await getRetailerShopifyFulfillmentOrderId(
        supplierShopifyOrderId,
        client,
    );
    const retailerSession = await getRetailerSession(retailerShopifyFulfillmentOrderId, client);
    await cancelFulfillmentOrderOnShopify(retailerShopifyFulfillmentOrderId, retailerSession);
    await updateOrderStatusToCancelledOnDb(dbOrderId, client);
}

export default cancelRetailerOrder;
