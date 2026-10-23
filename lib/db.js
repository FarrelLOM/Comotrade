import 'server-only';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import mysql from 'mysql2/promise';

let pool;

function getSslOptions() {
  if (process.env.DB_SSL === 'false') return undefined;

  const ca = process.env.DB_SSL_CA?.trim();
  if (!ca) return { rejectUnauthorized: true };

  const certificate = ca.includes('-----BEGIN')
    ? ca.replace(/\\n/g, '\n')
    : readFileSync(isAbsolute(ca) ? ca : resolve(process.cwd(), ca), 'utf8');

  return { ca: certificate, rejectUnauthorized: true };
}

export function getPool() {
  if (pool) return pool;

  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Database configuration is incomplete: ${missing.join(', ')}`);
  }

  const port = Number(process.env.DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be a valid TCP port.');
  }

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: getSslOptions(),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 8_000,
    decimalNumbers: true,
    charset: 'utf8mb4',
  });
  return pool;
}

async function execute(target, text, values = []) {
  const [result] = await target.execute(text, values);
  if (Array.isArray(result)) {
    return { rows: result, rowCount: result.length };
  }
  return { rows: [], rowCount: result.affectedRows, insertId: result.insertId };
}

export async function query(text, values = []) {
  return execute(getPool(), text, values);
}

export async function withTransaction(callback) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const transaction = {
      query: (text, values = []) => execute(connection, text, values),
    };
    const result = await callback(transaction);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
