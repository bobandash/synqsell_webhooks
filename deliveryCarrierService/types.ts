type Address = {
    country: string;
    postal_code: string;
    province: string;
    city: string;
    name: string | null;
    address1: string;
    address2: string;
    address3: string | null;
    phone: string | null;
    fax: string | null;
    email: string | null;
    address_type: string | null;
    company_name: string | null;
};

type Item = {
    name: string;
    sku: string;
    quantity: number;
    grams: number;
    price: number;
    vendor: string;
    requires_shipping: boolean;
    taxable: boolean;
    fulfillment_service: string;
    properties: any | null;
    product_id: number;
    variant_id: number;
};

type Rate = {
    origin: Address;
    destination: Address;
    items: Item[];
    currency: string;
    locale: string;
};

export type ShopifyShippingDetails = {
    rate: Rate;
};
