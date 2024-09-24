import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool, PoolClient } from 'pg';
import { composeGid } from '@shopify/admin-graphql-api-utilities';

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
    properties: null;
    product_id: number;
    variant_id: number;
};

type RequestBody = {
    rate: {
        origin: Address;
        destination: Address;
        items: Item[];
        currency: string;
        locale: string;
    };
};

let pool: Pool | null = null;
const CannotHandleResponse = {
    statusCode: 200,
    body: '[]',
};

async function initializePool() {
    if (!pool) {
        // https://stackoverflow.com/questions/76899023/rds-while-connection-error-no-pg-hba-conf-entry-for-host
        pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DATABASE,
            password: process.env.DB_PASSWORD,
            port: Number(process.env.DB_PORT) ?? 5432,
            max: 20,
            ssl: {
                rejectUnauthorized: false,
            },
        });
    }
    return pool;
}

async function hasCustomShippingPrice(shopifyVariantIds: string[], client: PoolClient) {
    const numImportedVariantsQuery = `SELECT COUNT(*) FROM "ImportedVariant" WHERE "shopifyVariantId" IN ANY($1::string[])`;
    const res = await client.query(numImportedVariantsQuery, shopifyVariantIds);
    const count = parseInt(res.rows[0].count);
    return count > 0;
}

async function getShippingRates() {
    return {
        rates: [
            {
                service_name: 'fedex-2dayground',
                service_code: '2D',
                total_price: '2934',
                currency: 'USD',
                min_delivery_date: '2013-04-12 14:48:45 -0400',
                max_delivery_date: '2013-04-12 14:48:45 -0400',
            },
        ],
    };
}

// https://shopify.dev/docs/api/admin-graphql/2024-07/objects/DeliveryCarrierService
// To indicate that this carrier service cannot handle this shipping request, return an empty array and any successful (20x) HTTP code.
// To force backup rates instead, return a 40x or 50x HTTP code with any content. A good choice is the regular 404 Not Found code.
// Redirects (30x codes) will only be followed for the same domain as the original callback URL. Attempting to redirect to a different domain will trigger backup rates

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    let client: null | PoolClient = null;
    try {
        const pool = await initializePool();
        client = await pool.connect();

        // carrier service cannot handle this shipping request, return an empty array and any successful (20x) HTTP code
        if (!event.body) {
            return CannotHandleResponse;
        }

        const body: RequestBody = JSON.parse(event.body);
        const shopifyImportedVariantIds = body.rate.items.map(({ variant_id }) =>
            composeGid('ProductVariant', variant_id),
        );
        if (!(await hasCustomShippingPrice(shopifyImportedVariantIds, client))) {
            return CannotHandleResponse;
        }
        const shippingRate = await getShippingRates();
        return {
            statusCode: 200,
            body: JSON.stringify(shippingRate),
        };
    } catch (err) {
        return {
            statusCode: 200,
            body: '[]',
        };
    } finally {
        if (client) {
            client.release();
        }
    }
};
