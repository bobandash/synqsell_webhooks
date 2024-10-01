import { PoolClient } from 'pg';
import paySupplierForDeliveredOrder from './paySupplierForDeliveredOrder';
import { Payload } from '../../types';

type ShipmentStatusUpdateParams = {
    shop: string;
    shipmentStatus: string | null;
    isRetailerFulfillment: boolean;
    isSupplierFulfillment: boolean;
    shopifyFulfillmentId: string;
    shopifyOrderId: string;
    client: PoolClient;
    payload: Payload;
};

async function handleShipmentStatusUpdate({
    shipmentStatus,
    isSupplierFulfillment,
    shop,
    shopifyFulfillmentId,
    shopifyOrderId,
    payload,
    client,
}: ShipmentStatusUpdateParams) {
    switch (shipmentStatus) {
        case 'delivered':
            if (isSupplierFulfillment) {
                await paySupplierForDeliveredOrder(shop, shopifyOrderId, shopifyFulfillmentId, payload, client);
            }
    }
}

export default handleShipmentStatusUpdate;
