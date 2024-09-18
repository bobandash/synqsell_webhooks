// set up functions for integration tests
// NOTE: the reason that I am setting up integration tests for lambda functions is because I found out lambda functions
// are extremely hard to test manually in Shopify because it's meant to impact data in many shopify stores that are connected
// while functions in the main project are easy to manually test for behavior because it only impacts one store
// But, I'm only writing integration/functional tests for the most common situations because it's the most impactful for amount of time put in writing tests

import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: "./.env.test" });

const pool = new Pool({
  host: process.env.TEST_DB_HOST || "localhost",
  port: Number(process.env.TEST_DB_PORT) || 5432,
  database: process.env.TEST_DB_NAME || "postgres",
  user: process.env.TEST_DB_USER || "postgres",
  password: process.env.TEST_DB_PASSWORD || "game789",
  ssl: false,
  idleTimeoutMillis: 0,
  connectionTimeoutMillis: 0,
});

async function clearAllTables() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
        DO $$ 
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema()) LOOP
            EXECUTE 'ALTER TABLE ' || quote_ident(r.tablename) || ' DISABLE TRIGGER ALL';
          END LOOP;
        END $$;
    `);

    await client.query(`
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema()) LOOP
            EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
        END $$;
      `);

    await client.query(`
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema()) LOOP
            EXECUTE 'ALTER TABLE ' || quote_ident(r.tablename) || ' ENABLE TRIGGER ALL';
          END LOOP;
        END $$;
      `);

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export { pool, clearAllTables };
