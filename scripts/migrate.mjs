import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import mysql from 'mysql2/promise';

const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Database configuration is incomplete: ${missing.join(', ')}`);
}

const caSetting = process.env.DB_SSL_CA?.trim();
const ssl = process.env.DB_SSL === 'false'
  ? undefined
  : {
      rejectUnauthorized: true,
      ...(caSetting
        ? {
            ca: caSetting.includes('-----BEGIN')
              ? caSetting.replace(/\\n/g, '\n')
              : readFileSync(isAbsolute(caSetting) ? caSetting : resolve(process.cwd(), caSetting), 'utf8'),
          }
        : {}),
    };
const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl,
  connectTimeout: 8000,
  charset: 'utf8mb4',
});

const migrationName = '001_marketplace.sql';
const enhancementMigrationName = '002_username_phone_product_unit.sql';
const requiredColumns = {
  users: ['id', 'username', 'full_name', 'phone', 'email', 'password_hash', 'google_sub', 'role'],
  products: ['id', 'slug', 'name', 'category', 'description', 'price', 'stock', 'satuan', 'origin', 'image_url', 'is_active', 'created_by'],
  orders: ['id', 'user_id', 'status', 'subtotal', 'shipping_cost', 'total', 'shipping_address', 'customer_note'],
  order_items: ['id', 'order_id', 'product_id', 'product_name', 'satuan', 'unit_price', 'quantity', 'line_total'],
  payments: ['id', 'order_id', 'provider', 'merchant_ref', 'provider_reference', 'status', 'amount', 'payment_url', 'payment_method', 'payment_code', 'expires_at'],
  shipments: ['id', 'order_id', 'carrier', 'tracking_number', 'tracking_url', 'shipped_at', 'delivered_at'],
  reviews: ['id', 'order_item_id', 'user_id', 'rating', 'body'],
  conversations: ['id', 'user_id', 'order_id', 'subject'],
  messages: ['id', 'conversation_id', 'sender_id', 'body'],
};

try {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(190) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const [applied] = await connection.execute(
    'SELECT name FROM schema_migrations WHERE name = ?',
    [migrationName],
  );
  if (applied.length) {
    console.log(`Migration ${migrationName} is already recorded; no schema changes were made.`);
    process.exitCode = 0;
  } else {
    const sql = await readFile(resolve(process.cwd(), 'my.sql'), 'utf8');
    for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
      await connection.query(statement);
    }

    const [columns] = await connection.execute(
      `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE()`,
    );
    const found = new Map();
    for (const column of columns) {
      if (!found.has(column.TABLE_NAME)) found.set(column.TABLE_NAME, new Set());
      found.get(column.TABLE_NAME).add(column.COLUMN_NAME);
    }
    const incompatible = Object.entries(requiredColumns).flatMap(([table, names]) =>
      names.filter((name) => !found.get(table)?.has(name)).map((name) => `${table}.${name}`),
    );
    if (incompatible.length) {
      throw new Error(
        `Existing tables do not match the MySQL marketplace schema: ${incompatible.join(', ')}. ` +
        'No tables or rows were dropped; inspect and back up this database before upgrading its structure.',
      );
    }

    await connection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [migrationName]);
    console.log(`Migration ${migrationName} applied successfully.`);
  }

  const [enhancementApplied] = await connection.execute(
    'SELECT name FROM schema_migrations WHERE name = ?',
    [enhancementMigrationName],
  );
  if (!enhancementApplied.length) {
    const [userColumns] = await connection.execute(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'users'`,
    );
    const userColumnNames = new Set(userColumns.map((column) => column.COLUMN_NAME));
    if (!userColumnNames.has('username')) {
      await connection.query('ALTER TABLE users ADD COLUMN username VARCHAR(32) NULL AFTER id');
    }
    if (!userColumnNames.has('phone')) {
      await connection.query('ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL AFTER full_name');
    }

    const [productColumns] = await connection.execute(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'products'`,
    );
    const productColumnNames = new Set(productColumns.map((column) => column.COLUMN_NAME));
    if (!productColumnNames.has('satuan')) {
      await connection.query("ALTER TABLE products ADD COLUMN satuan VARCHAR(40) NOT NULL DEFAULT 'unit' AFTER stock");
    }

    const [itemColumns] = await connection.execute(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'order_items'`,
    );
    if (!new Set(itemColumns.map((column) => column.COLUMN_NAME)).has('satuan')) {
      await connection.query("ALTER TABLE order_items ADD COLUMN satuan VARCHAR(40) NOT NULL DEFAULT 'unit' AFTER product_name");
    }

    const [existingUsernames] = await connection.execute(
      'SELECT id, email, username FROM users ORDER BY created_at, id',
    );
    const usedUsernames = new Set(existingUsernames
      .map((user) => user.username?.trim().toLowerCase())
      .filter(Boolean));
    for (const user of existingUsernames) {
      if (user.username?.trim()) continue;
      const base = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').replace(/^[^a-z0-9]+/, '').slice(0, 32) || 'user';
      let candidate = base;
      let suffix = 1;
      while (usedUsernames.has(candidate)) {
        const postfix = `_${suffix++}`;
        candidate = `${base.slice(0, 32 - postfix.length)}${postfix}`;
      }
      await connection.execute('UPDATE users SET username = ? WHERE id = ?', [candidate, user.id]);
      usedUsernames.add(candidate);
    }

    const [usernameCountRows] = await connection.execute(
      'SELECT COUNT(*) AS total, COUNT(DISTINCT username) AS distinct_total FROM users',
    );
    if (Number(usernameCountRows[0].total) !== Number(usernameCountRows[0].distinct_total)) {
      throw new Error('Existing usernames are not unique. Resolve duplicates before applying the username index.');
    }
    await connection.query('ALTER TABLE users MODIFY username VARCHAR(32) NOT NULL');
    const [usernameIndexes] = await connection.execute(
      `SELECT INDEX_NAME FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'username'`,
    );
    if (!usernameIndexes.length) {
      await connection.query('ALTER TABLE users ADD UNIQUE INDEX uq_users_username (username)');
    }
    await connection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [enhancementMigrationName]);
    console.log(`Migration ${enhancementMigrationName} applied successfully.`);
  } else {
    console.log(`Migration ${enhancementMigrationName} is already recorded; no schema changes were made.`);
  }

  const [finalColumns] = await connection.execute(
    `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.columns
     WHERE table_schema = DATABASE()`,
  );
  const finalFound = new Map();
  for (const column of finalColumns) {
    if (!finalFound.has(column.TABLE_NAME)) finalFound.set(column.TABLE_NAME, new Set());
    finalFound.get(column.TABLE_NAME).add(column.COLUMN_NAME);
  }
  const finalIncompatible = Object.entries(requiredColumns).flatMap(([table, names]) =>
    names.filter((name) => !finalFound.get(table)?.has(name)).map((name) => `${table}.${name}`),
  );
  if (finalIncompatible.length) {
    throw new Error(`Required marketplace columns are missing: ${finalIncompatible.join(', ')}`);
  }
} finally {
  await connection.end();
}
