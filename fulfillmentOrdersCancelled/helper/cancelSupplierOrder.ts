import { PoolClient } from 'pg';
import { Session } from '../types';
import { mutateAndValidateGraphQLData } from '../util';
import { OrderCancelMutation } from '../types/admin.generated';
import { CANCEL_ORDER_MUTATION } from '../graphql';
import { ORDER_PAYMENT_STATUS } from '../constants';

// ==============================================================================================================
// START: CANCEL FULFILLMENT ORDER ON RETAILER'S STORE LOGIC
// ==============================================================================================================

async function getOrderIdFromDatabase(shopifyRetailerFulfillmentOrderId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "id" FROM "Order"
          WHERE "shopifyRetailerFulfillmentOrderId" = $1
          LIMIT 1
        `;
        const queryRes = await client.query(query, [shopifyRetailerFulfillmentOrderId]);
        if (queryRes.rows.length === 0) {
            throw new Error(
                'No order exists for shopifyRetailerFulfillmentOrderId ' + shopifyRetailerFulfillmentOrderId,
            );
        }

        return queryRes.rows[0].id as string;
    } catch (error) {
        console.error(error);
        throw new Error(
            'Failed to database order id for shopifyRetailerFulfillmentOrderId ' + shopifyRetailerFulfillmentOrderId,
        );
    }
}

async function getSupplierShopifyOrderId(shopifyRetailerFulfillmentOrderId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "shopifySupplierOrderId" FROM "Order"
          WHERE "shopifyRetailerFulfillmentOrderId" = $1
          LIMIT 1
        `;
        const queryRes = await client.query(query, [shopifyRetailerFulfillmentOrderId]);
        if (queryRes.rows.length === 0) {
            throw new Error(
                'No shopifySupplierOrderId exists for shopifyRetailerFulfillmentOrderId ' +
                    shopifyRetailerFulfillmentOrderId,
            );
        }

        return queryRes.rows[0].shopifyRetailerFulfillmentOrderId as string;
    } catch (error) {
        console.error(error);
        throw new Error(
            'Failed to get shopifySupplierOrderId from shopifyRetailerFulfillmentOrderId ' +
                shopifyRetailerFulfillmentOrderId,
        );
    }
}

async function getSupplierSession(dbOrderId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "Session".* FROM "Order"
          INNER JOIN "Session" ON "Order"."supplierId" = "Session"."id"
          WHERE "Order"."id" = $1
          LIMIT 1
        `;
        const queryRes = await client.query(query, [dbOrderId]);
        if (queryRes.rows.length === 0) {
            throw new Error('No supplier session exists for database order id ' + dbOrderId);
        }

        return queryRes.rows[0] as Session;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to retrieve retailer session from database order id ' + dbOrderId);
    }
}

async function cancelSupplierOrderOnShopify(shopifySupplierOrderId: string, supplierSession: Session) {
    // because the order is technically a mock order that's just synced together, I don't need to deal with refund
    const input = {
        notifyCustomer: false,
        orderId: shopifySupplierOrderId,
        reason: 'CUSTOMER',
        refund: false,
        restock: true,
        staffNote: 'Retailer cancelled order on Syqnsell.',
    };

    await mutateAndValidateGraphQLData<OrderCancelMutation>(
        supplierSession.shop,
        supplierSession.accessToken,
        CANCEL_ORDER_MUTATION,
        {
            ...input,
        },
        `Failed to cancel supplier's order ${shopifySupplierOrderId}`,
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

async function cancelSupplierOrder(shopifyRetailerFulfillmentOrderId: string, client: PoolClient) {
    // steps:
    // cancel the supplier order on shopify
    // mark the payment status as cancelled

    const dbOrderId = await getOrderIdFromDatabase(shopifyRetailerFulfillmentOrderId, client);
    const shopifySupplierOrderId = await getSupplierShopifyOrderId(shopifyRetailerFulfillmentOrderId, client);
    const supplierSession = await getSupplierSession(dbOrderId, client);
    await cancelSupplierOrderOnShopify(shopifySupplierOrderId, supplierSession);
    await updateOrderStatusToCancelledOnDb(dbOrderId, client);
}

export default cancelSupplierOrder;
