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
            admin_graphql_api_id: string;
            app_id: number | null;
            browser_ip: string | null;
            buyer_accepts_marketing: boolean;
            cancel_reason: string | null;
            cancelled_at: string | null;
            cart_token: string | null;
            checkout_id: number | null;
            checkout_token: string | null;
            client_details: null;
            closed_at: string | null;
            confirmation_number: string | null;
            confirmed: boolean;
            contact_email: string;
            created_at: string;
            currency: string;
            current_shipping_price_set: {
                shop_money: { amount: string; currency_code: string };
                presentment_money: { amount: string; currency_code: string };
            };
            current_subtotal_price: string;
            current_subtotal_price_set: {
                shop_money: { amount: string; currency_code: string };
                presentment_money: { amount: string; currency_code: string };
            };
            current_total_additional_fees_set: null;
            current_total_discounts: string;
            current_total_discounts_set: {
                shop_money: { amount: string; currency_code: string };
                presentment_money: { amount: string; currency_code: string };
            };
            current_total_duties_set: null;
            current_total_price: string;
            current_total_price_set: {
                shop_money: { amount: string; currency_code: string };
                presentment_money: { amount: string; currency_code: string };
            };
            current_total_tax: string;
            current_total_tax_set: {
                shop_money: { amount: string; currency_code: string };
                presentment_money: { amount: string; currency_code: string };
            };
            customer_locale: string;
            device_id: null;
            discount_codes: any[];
            email: string;
            estimated_taxes: boolean;
            financial_status: string;
            fulfillment_status: string;
            landing_site: null;
            landing_site_ref: null;
            location_id: null;
            merchant_business_entity_id: string;
            merchant_of_record_app_id: null;
            name: string;
            note: null;
            note_attributes: any[];
            number: number;
            order_number: number;
            order_status_url: string;
            original_total_additional_fees_set: null;
            original_total_duties_set: null;
            payment_gateway_names: string[];
            phone: null;
            po_number: null;
            presentment_currency: string;
            processed_at: string;
            reference: null;
            referring_site: null;
            source_identifier: null;
            source_name: string;
            source_url: null;
            subtotal_price: string;
            subtotal_price_set: {
                shop_money: { amount: string; currency_code: string };
                presentment_money: { amount: string; currency_code: string };
            };
            tags: string;
            tax_exempt: boolean;
            tax_lines: any[];
            taxes_included: boolean;
            test: boolean;
            token: string;
            total_cash_rounding_payment_adjustment_set: {
                shop_money: { amount: string; currency_code: string };
                presentment_money: { amount: string; currency_code: string };
            };
            total_cash_rounding_refund_adjustment_set: {
                shop_money: { amount: string; currency_code: string };
                presentment_money: { amount: string; currency_code: string };
            };
            total_discounts: string;
            total_discounts_set: {
                shop_money: { amount: string; currency_code: string };
                presentment_money: { amount: string; currency_code: string };
            };
            total_line_items_price: string;
            total_line_items_price_set: {
                shop_money: { amount: string; currency_code: string };
                presentment_money: { amount: string; currency_code: string };
            };
            total_outstanding: string;
            total_price: string;
            total_price_set: {
                shop_money: { amount: string; currency_code: string };
                presentment_money: { amount: string; currency_code: string };
            };
            total_shipping_price_set: {
                shop_money: { amount: string; currency_code: string };
                presentment_money: { amount: string; currency_code: string };
            };
            total_tax: string;
            total_tax_set: {
                shop_money: { amount: string; currency_code: string };
                presentment_money: { amount: string; currency_code: string };
            };
            total_tip_received: string;
            total_weight: number;
            updated_at: string;
            user_id: null;
            billing_address: {
                first_name: string;
                address1: string;
                phone: string;
                city: string;
                zip: string;
                province: string;
                country: string;
                last_name: string;
                address2: null;
                company: string;
                latitude: null;
                longitude: null;
                name: string;
                country_code: string;
                province_code: string;
            };
            customer: {
                id: number;
                email: string;
                created_at: null;
                updated_at: null;
                first_name: string;
                last_name: string;
                state: string;
                note: null;
                verified_email: boolean;
                multipass_identifier: null;
                tax_exempt: boolean;
                phone: null;
                email_marketing_consent: {
                    state: string;
                    opt_in_level: null;
                    consent_updated_at: null;
                };
                sms_marketing_consent: null;
                tags: string;
                currency: string;
                tax_exemptions: any[];
                admin_graphql_api_id: string;
                default_address: {
                    id: number;
                    customer_id: number;
                    first_name: null;
                    last_name: null;
                    company: null;
                    address1: string;
                    address2: null;
                    city: string;
                    province: string;
                    country: string;
                    zip: string;
                    phone: string;
                    name: string;
                    province_code: string;
                    country_code: string;
                    country_name: string;
                    default: boolean;
                };
            };
            discount_applications: any[];
            fulfillments: any[];
            line_items: Array<{
                id: number;
                admin_graphql_api_id: string;
                attributed_staffs: Array<{ id: string; quantity: number }>;
                current_quantity: number;
                fulfillable_quantity: number;
                fulfillment_service: string;
                fulfillment_status: null;
                gift_card: boolean;
                grams: number;
                name: string;
                price: string;
                price_set: {
                    shop_money: { amount: string; currency_code: string };
                    presentment_money: { amount: string; currency_code: string };
                };
                product_exists: boolean;
                product_id: number;
                properties: any[];
                quantity: number;
                requires_shipping: boolean;
                sku: string;
                taxable: boolean;
                title: string;
                total_discount: string;
                total_discount_set: {
                    shop_money: { amount: string; currency_code: string };
                    presentment_money: { amount: string; currency_code: string };
                };
                variant_id: number;
                variant_inventory_management: string;
                variant_title: null;
                vendor: null;
                tax_lines: any[];
                duties: any[];
                discount_allocations: any[];
            }>;
            payment_terms: null;
            refunds: any[];
            shipping_address: {
                first_name: string;
                address1: string;
                phone: string;
                city: string;
                zip: string;
                province: string;
                country: string;
                last_name: string;
                address2: null;
                company: string;
                latitude: null;
                longitude: null;
                name: string;
                country_code: string;
                province_code: string;
            };
            shipping_lines: Array<{
                id: number;
                carrier_identifier: null;
                code: null;
                current_discounted_price_set: {
                    shop_money: { amount: string; currency_code: string };
                    presentment_money: { amount: string; currency_code: string };
                };
                discounted_price: string;
                discounted_price_set: {
                    shop_money: { amount: string; currency_code: string };
                    presentment_money: { amount: string; currency_code: string };
                };
                is_removed: boolean;
                phone: null;
                price: string;
                price_set: {
                    shop_money: { amount: string; currency_code: string };
                    presentment_money: { amount: string; currency_code: string };
                };
                requested_fulfillment_service_id: null;
                source: string;
                title: string;
                tax_lines: any[];
                discount_allocations: any[];
            }>;
            returns: any[];
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

export type LineItemDetail = {
    shopifyLineItemId: string;
    quantity: number;
};
