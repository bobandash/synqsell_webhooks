// case: supplier mistakenly bought incorrect tracking label, have to refund and update for the customer
import { PoolClient } from 'pg';
import { Session } from '../types';
import { mutateAndValidateGraphQLData } from '../util';
import { FulfillmentCancelMutation } from '../types/admin.generated';
import { CANCEL_FULFILLMENT_MUTATION } from '../graphql';

// ==============================================================================================================
// START: CANCEL FULFILLMENT ON RETAILER STORE LOGIC
// ==============================================================================================================

async function getDbFulfillmentId(supplierShopifyFulfillmentId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "id" FROM "Fulfillment"
          WHERE "supplierShopifyFulfillmentId" = $1
          LIMIT 1
        `;
        const res = await client.query(query, [supplierShopifyFulfillmentId]);
        if (res.rows.length === 0) {
            throw new Error(
                `No fulfillment row exists for supplierShopifyFulfillmentId ${supplierShopifyFulfillmentId}.`,
            );
        }
        return res.rows[0].id as string;
    } catch (error) {
        console.error(error);
        throw new Error(
            `Failed to retrieve database fulfillment id from supplierShopifyFulfillmentId ${supplierShopifyFulfillmentId}.`,
        );
    }
}

async function getDbOrderId(dbFulfillmentId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "orderId" FROM "Fulfillment"
          WHERE "dbFulfillmentId" = $1
          LIMIT 1
        `;
        const res = await client.query(query, [dbFulfillmentId]);
        if (res.rows.length === 0) {
            throw new Error(`No order id exists for dbFulfillmentId ${dbFulfillmentId}.`);
        }
        return res.rows[0].orderId as string;
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to retrieve database order id from supplierShopifyFulfillmentId ${dbFulfillmentId}.`);
    }
}

async function getRetailerShopifyFulfillmentId(dbFulfillmentId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "retailerShopifyFulfillmentId" FROM "Fulfillment"
          WHERE "id" = $1
          LIMIT 1
        `;
        const res = await client.query(query, [dbFulfillmentId]);
        if (res.rows.length === 0) {
            throw new Error(`No fulfillment row exists for dbFulfillmentId ${dbFulfillmentId}.`);
        }
        return res.rows[0].retailerShopifyFulfillmentId as string;
    } catch (error) {
        console.error(error);
        throw new Error(
            `Failed to retrieve retailerShopifyFulfillmentId from database fuflfillment id ${dbFulfillmentId}.`,
        );
    }
}

async function getRetailerSession(dbOrderId: string, client: PoolClient) {
    try {
        const query = `
          SELECT "Session".* FROM "Order"
          INNER JOIN "Session" ON "Order"."retailerId" = "Session"."id"
          WHERE "Order"."id" = $1
        `;
        const res = await client.query(query, [dbOrderId]);
        if (res.rows.length === 0) {
            throw new Error(`No retailer session exists for dbOrderId ${dbOrderId}.`);
        }
        return res.rows[0] as Session;
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to retrieve retailer session from dbOrderId ${dbOrderId}.`);
    }
}

async function removeRetailerFulfillmentShopify(retailerSession: Session, retailerShopifyFulfillmentId: string) {
    await mutateAndValidateGraphQLData<FulfillmentCancelMutation>(
        retailerSession.shop,
        retailerSession.accessToken,
        CANCEL_FULFILLMENT_MUTATION,
        {
            id: retailerShopifyFulfillmentId,
        },
        `Could not cancel fulfillment for ${retailerShopifyFulfillmentId}`,
    );
}

async function removeFulfillmentDatabase(dbFulfillmentId: string, client: PoolClient) {
    try {
        const query = `DELETE FROM "Fulfillment" WHERE "id" = $1`;
        await client.query(query, [dbFulfillmentId]);
    } catch (error) {
        console.error(error);
        throw new Error(`Failed to remove fulfillment ${dbFulfillmentId} from database.`);
    }
}

// ==============================================================================================================
// START: END CANCEL FULFILLMENT ON RETAILER STORE LOGIC
// ==============================================================================================================

async function cancelRetailerFulfillment(supplierShopifyFulfillmentId: string, client: PoolClient) {
    const dbFulfillmentId = await getDbFulfillmentId(supplierShopifyFulfillmentId, client);
    const dbOrderId = await getDbOrderId(dbFulfillmentId, client);
    const retailerShopifyFulfillmentId = await getRetailerShopifyFulfillmentId(supplierShopifyFulfillmentId, client);
    const retailerSession = await getRetailerSession(dbOrderId, client);
    await removeRetailerFulfillmentShopify(retailerSession, retailerShopifyFulfillmentId);
    await removeFulfillmentDatabase(dbFulfillmentId, client);
}

export default cancelRetailerFulfillment;
