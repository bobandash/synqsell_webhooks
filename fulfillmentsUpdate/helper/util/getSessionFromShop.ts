import { PoolClient } from 'pg';
import { Session } from '../../types';

async function getSessionFromShop(shop: string, client: PoolClient) {
    const sessionQuery = `SELECT * FROM "Session" WHERE shop = $1 LIMIT 1`;
    const sessionData = await client.query(sessionQuery, [shop]);
    if (sessionData.rows.length === 0) {
        throw new Error('Shop data is invalid.');
    }
    const session = sessionData.rows[0];
    return session as Session;
}

export default getSessionFromShop;
