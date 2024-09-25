import { lambdaHandler } from '../app';
import { pool, clearAllTables } from '../../integration-setup';
import { initializePool } from '../db';
import { Pool } from 'pg';
import {
    getRetailerProductUpdateEvent,
    getSupplierProductUpdateEvent,
    notSynqsellProductUpdateEvent,
} from './constants';
import { DEFAULT_ITEMS, priceListWithProductAndImportedProductMutation } from '../../commonDataMutation';
import * as utils from '../util';
import * as helperFunctions from '../helper';
import { composeGid } from '@shopify/admin-graphql-api-utilities';

// TODO: Not important right not, but verify that wholesale price list functions properly
jest.mock('../db');
jest.mock('../util', () => {
    const actualUtil = jest.requireActual('../util');
    return {
        ...actualUtil,
        fetchAndValidateGraphQLData: jest.fn().mockImplementation(() => Promise.resolve('')),
        mutateAndValidateGraphQLData: jest.fn().mockImplementation(() => Promise.resolve('')),
    };
});
const mockedInitializePool = initializePool as jest.Mock<Pool>;

describe('Shopify products/update webhook', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        mockedInitializePool.mockReturnValue(pool);
        const client = await pool.connect();
        await client.query(priceListWithProductAndImportedProductMutation);
        client.release();
    }, 30000);

    afterEach(async () => {
        await clearAllTables();
    });

    afterAll(async () => {
        await clearAllTables();
        await pool.end();
    });

    describe('Not Synqsell Product', () => {
        test('should not perform any operations if not SynqSell product', async () => {
            const payload = notSynqsellProductUpdateEvent;
            const result = await lambdaHandler(payload);
            expect(result.statusCode).toBe(200);
            expect(result.body).toBe(
                JSON.stringify({ message: 'Do not need to handle logic for products not in Synqsell.' }),
            );
        });
    });

    // these tests are related to revertRetailerProductModifications
    // this is to prevent an infinite loop in webhook logic
    describe('revertRetailerProductModifications', () => {
        test(`should not update retailer product if price and inventory still matches supplier's`, async () => {
            const payload = getRetailerProductUpdateEvent(DEFAULT_ITEMS.SHOPIFY_VARIANT_RETAIL_PRICE, 50);
            (utils.fetchAndValidateGraphQLData as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    productVariant: {
                        id: DEFAULT_ITEMS.SHOPIFY_VARIANT_ID,
                        price: DEFAULT_ITEMS.SHOPIFY_VARIANT_RETAIL_PRICE,
                        inventoryQuantity: 50,
                    },
                }),
            );
            const spyGraphQLMutationFunc = jest.spyOn(utils, 'mutateAndValidateGraphQLData');
            const spyRevertRetailerProductFunc = jest.spyOn(helperFunctions, 'revertRetailerProductModifications');
            const result = await lambdaHandler(payload);
            expect(spyGraphQLMutationFunc).toHaveBeenCalledTimes(0);
            expect(spyRevertRetailerProductFunc).toHaveBeenCalledTimes(1);
            expect(result.body).toBe(JSON.stringify({ message: 'Successfully handled product update webhook.' }));
            expect(result.statusCode).toBe(200);
        });

        // TODO: download rewire and add tests
        // test(`should update retailer product if retailer's product price does not match supplier's`, async () => {
        //     const payload = getRetailerProductUpdateEvent(DEFAULT_ITEMS.SHOPIFY_VARIANT_RETAIL_PRICE, 50);
        //     (utils.fetchAndValidateGraphQLData as jest.Mock).mockImplementationOnce(() =>
        //         Promise.resolve({
        //             productVariant: {
        //                 id: DEFAULT_ITEMS.SHOPIFY_VARIANT_ID,
        //                 price: (Number(DEFAULT_ITEMS.SHOPIFY_VARIANT_RETAIL_PRICE) - 1).toString(),
        //                 inventoryQuantity: 50,
        //             },
        //         }),
        //     );
        //     const spyRevertRetailerProductFunc = jest.spyOn(helperFunctions, 'revertRetailerProductModifications');
        //     const spyGraphQLMutationFunc = jest.spyOn(utils, 'mutateAndValidateGraphQLData');
        //     const result = await lambdaHandler(payload);

        //     expect(spyRevertRetailerProductFunc).toHaveBeenCalledTimes(1);
        //     expect(spyGraphQLMutationFunc).toHaveBeenCalledTimes(1);
        //     expect(result.body).toBe(JSON.stringify({ message: 'Successfully handled product update webhook.' }));
        // });

        // test(`should update retailer product if retailer's inventory does not match supplier's`, async () => {
        //     const payload = getRetailerProductUpdateEvent(DEFAULT_ITEMS.SHOPIFY_VARIANT_RETAIL_PRICE, 75);
        //     (utils.fetchAndValidateGraphQLData as jest.Mock).mockImplementationOnce(() =>
        //         Promise.resolve({
        //             productVariant: {
        //                 id: DEFAULT_ITEMS.SHOPIFY_VARIANT_ID,
        //                 price: DEFAULT_ITEMS.SHOPIFY_VARIANT_RETAIL_PRICE,
        //                 inventoryQuantity: 50,
        //             },
        //         }),
        //     );
        //     const spyRevertRetailerProductFunc = jest.spyOn(helperFunctions, 'revertRetailerProductModifications');
        //     const spyGraphQLMutationFunc = jest.spyOn(utils, 'mutateAndValidateGraphQLData');
        //     const result = await lambdaHandler(payload);

        //     expect(spyRevertRetailerProductFunc).toHaveBeenCalledTimes(1);
        //     expect(spyGraphQLMutationFunc).toHaveBeenCalledTimes(1);
        //     expect(result.body).toBe(JSON.stringify({ message: 'Successfully handled product update webhook.' }));
        // });
    });

    // describe('broadcastSupplierProductModifications', () => {
    //     test('should update all retailer products if supplier product changed', async () => {
    //         const client = await pool.connect();
    //         const importedProductCountQuery = `
    //             SELECT COUNT(*) FROM "Product"
    //             JOIN "ImportedProduct" ON "ImportedProduct"."prismaProductId" = "Product"."id"
    //             WHERE "Product"."shopifyProductId" = $1
    //         `;

    //         const numImportedProducts = (
    //             await client.query(importedProductCountQuery, [composeGid('Product', DEFAULT_ITEMS.SHOPIFY_PRODUCT_ID)])
    //         ).rows[0].count as string;

    //         const spyGraphQLMutationFunc = jest.spyOn(utils, 'mutateAndValidateGraphQLData');
    //         const spyBroadcastFunc = jest.spyOn(helperFunctions, 'broadcastSupplierProductModifications');
    //         const newRetailPrice = '59.99';
    //         const payload = getSupplierProductUpdateEvent(newRetailPrice, 1000);
    //         const result = await lambdaHandler(payload);
    //         const retailPriceQuery = `
    //             SELECT "retailPrice" FROM "Variant" WHERE "shopifyVariantId" = $1
    //         `;
    //         const retailPrices = await client.query(retailPriceQuery, [DEFAULT_ITEMS.SHOPIFY_VARIANT_ID]);
    //         // updates retail price in database
    //         retailPrices.rows.forEach(({ retailPrice }) => {
    //             expect(retailPrice).toBe(newRetailPrice);
    //         });
    //         expect(result.body).toBe(JSON.stringify({ message: 'Successfully handled product update webhook.' }));
    //         expect(result.statusCode).toBe(200);
    //         expect(spyBroadcastFunc).toHaveBeenCalledTimes(1);
    //         expect(spyGraphQLMutationFunc).toHaveBeenCalledTimes(Number(numImportedProducts));
    //         client.release();
    //     });
    // });
});
