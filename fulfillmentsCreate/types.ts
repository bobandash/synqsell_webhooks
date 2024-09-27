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
            created_at: string; // ISO 8601 date string
            service: null | string;
            updated_at: string; // ISO 8601 date string
            tracking_company: string;
            shipment_status: null | string;
            location_id: null | number;
            origin_address: null | object;
            email: string;
            destination: {
                first_name: string;
                address1: string;
                phone: string;
                city: string;
                zip: string;
                province: string;
                country: string;
                last_name: string;
                address2: null | string;
                company: string;
                latitude: null | number;
                longitude: null | number;
                name: string;
                country_code: string;
                province_code: string;
            };
            line_items: Array<{
                id: number;
                variant_id: number;
                title: string;
                quantity: number;
                sku: string;
                variant_title: null | string;
                vendor: null | string;
                fulfillment_service: string;
                product_id: number;
                requires_shipping: boolean;
                taxable: boolean;
                gift_card: boolean;
                name: string;
                variant_inventory_management: string;
                properties: any[];
                product_exists: boolean;
                fulfillable_quantity: number;
                grams: number;
                price: string;
                total_discount: string;
                fulfillment_status: null | string;
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
                discount_allocations: Array<{
                    amount: string;
                    discount_application_index: number;
                    amount_set: {
                        shop_money: {
                            amount: string;
                            currency_code: string;
                        };
                        presentment_money: {
                            amount: string;
                            currency_code: string;
                        };
                    };
                }>;
                duties: any[];
                admin_graphql_api_id: string;
                tax_lines: any[];
            }>;
            tracking_number: string;
            tracking_numbers: string[];
            tracking_url: string;
            tracking_urls: string[];
            receipt: object;
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
