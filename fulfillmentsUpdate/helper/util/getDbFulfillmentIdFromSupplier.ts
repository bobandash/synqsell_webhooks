import { PoolClient } from 'pg';

async function getDbFulfillmentIdFromSupplier(supplierShopifyFulfillmentId: string, client: PoolClient) {
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

export default getDbFulfillmentIdFromSupplier;
