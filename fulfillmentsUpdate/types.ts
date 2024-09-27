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
            order_id: number;
            status: string;
            created_at: string;
            service: string;
            updated_at: string;
            tracking_company: string | null;
            shipment_status: string | null;
            location_id: number;
            origin_address: null;
            email: string;
            destination: {
                first_name: string;
                address1: string;
                phone: string | null;
                city: string;
                zip: string;
                province: string | null;
                country: string;
                last_name: string;
                address2: string | null;
                company: string | null;
                latitude: number;
                longitude: number;
                name: string;
                country_code: string;
                province_code: string | null;
            };
            line_items: Array<{
                id: number;
                variant_id: number;
                title: string;
                quantity: number;
                sku: string;
                variant_title: string | null;
                vendor: string;
                fulfillment_service: string;
                product_id: number;
                requires_shipping: boolean;
                taxable: boolean;
                gift_card: boolean;
                name: string;
                variant_inventory_management: string;
                properties: Array<any>;
                product_exists: boolean;
                fulfillable_quantity: number;
                grams: number;
                price: string;
                total_discount: string;
                fulfillment_status: string | null;
                price_set: {
                    shop_money: {
                        amount: string;
                        currency_code: string;
                    };
                    presentment_money: {
                        amount: string;
                        currency_code: string;
                    };
                };
                total_discount_set: {
                    shop_money: {
                        amount: string;
                        currency_code: string;
                    };
                    presentment_money: {
                        amount: string;
                        currency_code: string;
                    };
                };
                discount_allocations: Array<any>;
                duties: Array<any>;
                admin_graphql_api_id: string;
                tax_lines: Array<any>;
            }>;
            tracking_number: string | null;
            tracking_numbers: Array<string>;
            tracking_url: string | null;
            tracking_urls: Array<string>;
            receipt: Record<string, any>;
            name: string;
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

export const ORDER_PAYMENT_STATUS = {
    INCOMPLETE: 'INCOMPLETE',
    PARTIALLY_PAID: 'PARTIALLY_PAID',
    PAID: 'PAID',
    CANCELLED: 'CANCELLED',
} as const;

export const ROLES = {
    RETAILER: 'RETAILER',
    SUPPLIER: 'SUPPLIER',
} as const;

export type FulfillmentDetail = {
    id: string;
    supplierShopifyFulfillmentId: string;
    retailerShopifyFulfillmentId: string;
    orderId: string;
};

export type PayloadLineItem = {
    id: string;
    quantity: number;
};

export type PayloadTrackingInfo = {
    company: string | null;
    numbers: string[];
    urls: string[];
};

export type OrderPaymentStatusProps = (typeof ORDER_PAYMENT_STATUS)[keyof typeof ORDER_PAYMENT_STATUS];
export type RolesProps = (typeof ROLES)[keyof typeof ROLES];
