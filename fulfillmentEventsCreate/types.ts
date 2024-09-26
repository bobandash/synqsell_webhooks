export type ShopifyEvent = {
    version: string;
    id: string;
    'detail-type': string;
    source: string;
    account: string;
    time: string;
    region: string;
    resources: string[];
    detail: {
        metadata: {
            'Content-Type': string;
            'X-Shopify-Topic': string;
            'X-Shopify-Hmac-Sha256': string;
            'X-Shopify-Shop-Domain': string;
            'X-Shopify-Webhook-Id': string;
            'X-Shopify-Triggered-At': string;
            'X-Shopify-Event-Id': string;
        };
        payload: {
            id: number;
            fulfillment_id: number;
            status: 'in_transit';
            message: string;
            happened_at: string;
            city: string | null;
            province: string | null;
            country: string;
            zip: string | null;
            address1: string | null;
            latitude: string | null;
            longitude: string | null;
            shop_id: number;
            created_at: string;
            updated_at: string;
            estimated_delivery_at: string | null;
            order_id: number;
            admin_graphql_api_id: string;
        };
    };
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
