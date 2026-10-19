import 'server-only';
import { Pool } from 'pg';

let pool;

export function getPool() {
  if (pool) return pool;

  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Database configuration is incomplete: ${missing.join(', ')}`);
  }

  pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME || 'defaultdb',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: true },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  });
  return pool;
}

export async function query(text, values = []) {
  return getPool().query(text, values);
}

export async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
