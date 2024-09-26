import { FulfillmentOrderDestination } from './types/admin.types';

export type ShopifyEvent = {
    version: string;
    id: string;
    'detail-type': string;
    source: string;
    account: string;
    time: string;
    region: string;
    resources: [];
    detail: {
        'X-Shopify-Topic': string;
        'X-Shopify-Hmac-Sha256': string;
        'X-Shopify-Shop-Domain': string;
        'X-Shopify-Webhook-Id': string;
        'X-Shopify-Triggered-At': string;
        'X-Shopify-Event-Id': string;
        payload: {
            fulfillment_order: {
                id: string;
                status: string;
            };
        };
    };
};

export type FulfillmentOrdersBySupplier = {
    fulfillmentOrderId: string;
    supplierId: string;
    orderLineItems: {
        shopifyLineItemId: string;
        quantity: number;
        shopifyVariantId: string;
        priceListId: string; // order lines can come from different price list ids
    }[];
};

export type Session = {
    id: string;
    shop: string;
    state: string;
    isOnline: boolean;
    scope?: string;
    expires?: Date;
    accessToken: string;
    userId?: bigint;
    firstName?: string;
    lastName?: string;
    email?: string;
    accountOwner: boolean;
    locale?: string;
    collaborator?: boolean;
    emailVerified?: boolean;
};

export type CustomerShippingDetails = Pick<
    FulfillmentOrderDestination,
    | 'address1'
    | 'address2'
    | 'city'
    | 'company'
    | 'countryCode'
    | 'email'
    | 'firstName'
    | 'lastName'
    | 'phone'
    | 'province'
    | 'zip'
>;
