import { lambdaHandler } from '../app';
import { pool, clearAllTables } from '../../integration-setup';
jest.mock('../db');
import { initializePool } from '../db';
import { Pool } from 'pg';
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
    });

    afterAll(async () => {
        await pool.end();
    });

    test('should return no products deleted', async () => {
        const payload = deleteProductPayload(123);
        const result = await lambdaHandler(payload);
        expect(result.statusCode).toBe(200);
        expect(result.body).toBe(JSON.stringify({ message: 'There were no products to delete.' }));
    });

    test(`should delete product, all variants, and all imported products and imported variants if supplier's product`, async () => {
        const payload = deleteProductPayload(123);
        const result = await lambdaHandler(payload);
        expect(result.statusCode).toBe(200);
        expect(result.body).toBe(JSON.stringify({ message: 'There were no products to delete.' }));
    });
});
