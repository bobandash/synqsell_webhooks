import { PoolClient } from 'pg';
import { Payload } from '../../types';
import cancelRetailerFulfillment from './cancelRetailerFulfillment';
import resyncRetailerFulfillment from './resyncRetailerFulfillment';

type FulfillmentUpdateParams = {
    shop: string;
    shopifyFulfillmentId: string;
    fulfillmentStatus: string;
    payload: Payload;
    isRetailerFulfillment: boolean;
    isSupplierFulfillment: boolean;
    client: PoolClient;
};

// coordinate to handle any fulfillment update
// retailer can cancel the fulfillment, meaning we have to read the supplier's information and keep products in sync
// supplier can cancel the fulfillment, then it would have to be broadcasted to the retailer and cancel the fulfillment there
async function handleFulfillmentUpdate({
    shop,
    shopifyFulfillmentId,
    fulfillmentStatus,
    payload,
    isRetailerFulfillment,
    isSupplierFulfillment,
    client,
}: FulfillmentUpdateParams) {
    switch (fulfillmentStatus) {
        case 'cancelled':
            if (isRetailerFulfillment) {
                await cancelRetailerFulfillment(shopifyFulfillmentId, client);
            } else if (isSupplierFulfillment) {
                await resyncRetailerFulfillment(shopifyFulfillmentId, shop, payload, client);
            }
            break;
    }
}
export default handleFulfillmentUpdate;
