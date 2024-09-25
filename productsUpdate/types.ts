export type EditedVariant = {
    shopifyVariantId: string;
    hasUpdatedInventory: boolean;
    newInventory: number;
    price: string;
};

export type PriceListDetails = {
    id: string;
    createdAt: Date;
    pricingStrategy: string;
    supplierId: string;
    isGeneral: boolean;
    name: string;
    requiresApprovalToImport?: boolean;
    margin?: number;
};

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
        'X-Shopify-Topic': string;
        'X-Shopify-Hmac-Sha256': string;
        'X-Shopify-Shop-Domain': string;
        'X-Shopify-Webhook-Id': string;
        'X-Shopify-Triggered-At': string;
        'X-Shopify-Event-Id': string;
        payload: {
            admin_graphql_api_id: string;
            body_html: string | null;
            created_at: string | null;
            handle: string;
            id: number;
            product_type: string;
            published_at: string;
            template_suffix: string | null;
            title: string;
            updated_at: string;
            vendor: string;
            status: string;
            published_scope: string;
            tags: string;
            variants: {
                admin_graphql_api_id: string;
                barcode: string | null;
                compare_at_price: string;
                created_at: string;
                id: number;
                inventory_policy: string;
                position: number;
                price: string;
                product_id: number;
                sku: string | null;
                taxable: boolean;
                title: string;
                updated_at: string;
                option1: string;
                option2: string | null;
                option3: string | null;
                image_id: number | null;
                inventory_item_id: number | null;
                inventory_quantity: number;
                old_inventory_quantity: number;
            }[];
            options: any[];
            images: any[];
            image: any | null;
            media: any[];
            variant_gids: {
                admin_graphql_api_id: string;
                updated_at: string;
            }[];
        };
    };
};
