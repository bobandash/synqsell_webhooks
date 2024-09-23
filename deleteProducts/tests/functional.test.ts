import { lambdaHandler } from '../app';
import { pool, clearAllTables } from '../../integration-setup';
import { initializePool } from '../db';
import { Pool } from 'pg';
import { DEFAULT_ITEMS, priceListWithProductAndImportedProductMutation } from '../../commonDataMutation';
import * as utils from '../util';
import { DELETE_PRODUCT_MUTATION } from '../graphql';
import { composeGid } from '@shopify/admin-graphql-api-utilities';
jest.mock('../db');
jest.mock('../util', () => ({
    mutateAndValidateGraphQLData: jest.fn().mockImplementation(() => Promise.resolve('Test')),
}));
const mockedInitializePool = initializePool as jest.Mock<Pool>;

const deleteProductPayload = (id: number) => {
    return {
        version: '0',
        id: 'abcd1234-5678-90ef-gh12-3456789ijklm',
        'detail-type': 'Shopify Topic',
        source: 'shopify.com/webhooks',
        account: '123456789012',
        time: '2023-08-15T12:34:56Z',
        region: 'us-east-1',
        resources: [],
        detail: {
            'X-Shopify-Topic': 'products/delete',
            'X-Shopify-Hmac-Sha256': 'hmac_value',
            'X-Shopify-Shop-Domain': 'example.myshopify.com',
            'X-Shopify-Webhook-Id': 'webhook_id',
            'X-Shopify-Triggered-At': '2024-08-15T12:34:56Z',
            'X-Shopify-Event-Id': 'event_id',
            payload: {
                id: id,
            },
        },
    };
};

describe('Delete Products Lambda Function Integration Tests', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        mockedInitializePool.mockReturnValue(pool);
        await clearAllTables();
    }, 30000);

    afterAll(async () => {
        await pool.end();
    });

    test('should return no products deleted', async () => {
        const payload = deleteProductPayload(DEFAULT_ITEMS.SHOPIFY_PRODUCT_ID);
        const result = await lambdaHandler(payload);
        expect(result.statusCode).toBe(200);
        expect(result.body).toBe(JSON.stringify({ message: 'There were no products to delete.' }));
    });

    test(`should delete product, all variants, and all imported products and imported variants if supplier's product`, async () => {
        const productDeleteMutationSpy = jest.spyOn(utils, 'mutateAndValidateGraphQLData');
        const client = await pool.connect();

        await client.query(priceListWithProductAndImportedProductMutation);
        const payload = deleteProductPayload(DEFAULT_ITEMS.SHOPIFY_PRODUCT_ID);
        const result = await lambdaHandler(payload);
        expect(result.body).toBe(JSON.stringify({ message: 'Successfully deleted products from database.' }));
        expect(result.statusCode).toBe(200);
        // need to ensure the imported product is deleted from shopify
        expect(productDeleteMutationSpy).toHaveBeenCalledWith(
            DEFAULT_ITEMS.RETAILER_SHOP,
            DEFAULT_ITEMS.RETAILER_ACCESS_TOKEN,
            DELETE_PRODUCT_MUTATION,
            {
                id: composeGid('Product', DEFAULT_ITEMS.IMPORTED_SHOPIFY_PRODUCT_ID),
            },
            'Could not delete product for retailer.',
        );
        // all the products, imported products, variants, and imported products have been deleted from db

        const countImportedProductQuery = 'SELECT COUNT(*) FROM "ImportedProduct"';
        const countImportedVariantQuery = 'SELECT COUNT(*) FROM "ImportedVariant"';
        const countVariantQuery = 'SELECT COUNT(*) FROM "Variant"';
        const countProductQuery = 'SELECT COUNT(*) FROM "Product"';

        const countProduct = (await client.query(countProductQuery)).rows[0].count;
        const countImportedProduct = (await client.query(countImportedProductQuery)).rows[0].count;
        const countImportedVariant = (await client.query(countImportedVariantQuery)).rows[0].count;
        const countVariant = (await client.query(countVariantQuery)).rows[0].count;

        expect(countProduct).toBe('0');
        expect(countImportedVariant).toBe('0');
        expect(countVariant).toBe('0');
        expect(countImportedProduct).toBe('0');
        client.release();
    });

    test(`should delete only imported product when imported product is deleted.`, async () => {
        const productDeleteMutationSpy = jest.spyOn(utils, 'mutateAndValidateGraphQLData');
        const client = await pool.connect();
        await client.query(priceListWithProductAndImportedProductMutation);

        const payload = deleteProductPayload(DEFAULT_ITEMS.IMPORTED_SHOPIFY_PRODUCT_ID);
        const result = await lambdaHandler(payload);
        expect(result.body).toBe(JSON.stringify({ message: 'Successfully deleted products from database.' }));
        expect(result.statusCode).toBe(200);
        // no call to shopify is made because it only affects retailer product
        expect(productDeleteMutationSpy).toHaveBeenCalledTimes(0);
        // all the imported products and variants have been deleted from db
        const countProductQuery = 'SELECT COUNT(*) FROM "Product"';
        const countImportedProductQuery = 'SELECT COUNT(*) FROM "ImportedProduct"';
        const countImportedProduct = (await client.query(countImportedProductQuery)).rows[0].count;
        const countProduct = (await client.query(countProductQuery)).rows[0].count;
        expect(countProduct).toBe('1');
        expect(countImportedProduct).toBe('0');
        client.release();
    });
});
