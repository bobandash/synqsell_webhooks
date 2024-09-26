import { PoolClient } from 'pg';
import { Session } from '../../types';

async function getSession(sessionId: string, client: PoolClient) {
    try {
        const sessionQuery = `SELECT * FROM "Session" WHERE "id" = $1`;
        const res = await client.query(sessionQuery, [sessionId]);
        const session: Session = res.rows[0];
        return session;
    } catch (error) {
        throw new Error('Failed to get session ' + sessionId);
    }
}

export default getSession;
