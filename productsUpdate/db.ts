import { Pool } from 'pg';

let pool: Pool | null = null;

function initializePool() {
    if (!pool) {
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

export { initializePool };
