import { pool, clearAllTables } from '../../integration-setup';
import { initializePool } from '../db';
import { Pool } from 'pg';
import '@types/jest';

jest.mock('../db');
const mockedInitializePool = initializePool as jest.Mock<Pool>;

describe('Fulfillment order split and creation in supplier store integration tests', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        mockedInitializePool.mockReturnValue(pool);
        await clearAllTables();
    }, 30000);

    afterAll(async () => {
        await pool.end();
    });
});
