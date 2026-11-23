-- FINAL DATABASE SCRIPT for MySQL 8+.
-- WARNING: this creates/reuses the schema and inserts a sample admin/products.
-- It does NOT drop any database or table. If you want a clean reset, DROP the
-- intended database manually first, then run this file. A manual DROP deletes
-- every user, order, payment, address, message, wallet entry, and product.
-- Verify DB_NAME and the selected server/schema before doing that.

CREATE DATABASE IF NOT EXISTS CLAUDE_PROJECTS
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE CLAUDE_PROJECTS;

CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(190) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  username VARCHAR(32) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  google_sub VARCHAR(255) NULL UNIQUE,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(200) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(120) NOT NULL DEFAULT 'Rempah',
  description TEXT NOT NULL,
  long_description TEXT NULL,
  harvest_duration VARCHAR(120) NULL,
  highlights_json JSON NULL,
  gallery_json JSON NULL,
  price DECIMAL(12, 2) NOT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  satuan VARCHAR(40) NOT NULL DEFAULT 'unit',
  shipping_weight_gram INT UNSIGNED NULL,
  shipping_length_cm INT UNSIGNED NULL,
  shipping_width_cm INT UNSIGNED NULL,
  shipping_height_cm INT UNSIGNED NULL,
  origin VARCHAR(300) NOT NULL DEFAULT '',
  image_url VARCHAR(1000) NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_products_price CHECK (price >= 0),
  CONSTRAINT chk_products_shipping CHECK (
    (shipping_weight_gram IS NULL AND shipping_length_cm IS NULL AND shipping_width_cm IS NULL AND shipping_height_cm IS NULL)
    OR (shipping_weight_gram IS NOT NULL AND shipping_length_cm IS NOT NULL AND shipping_width_cm IS NOT NULL AND shipping_height_cm IS NOT NULL
      AND shipping_weight_gram > 0 AND shipping_length_cm > 0 AND shipping_width_cm > 0 AND shipping_height_cm > 0)
  ),
  CONSTRAINT fk_products_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_products_active_name (is_active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS warehouses (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(254) NULL,
  address_line VARCHAR(1000) NOT NULL,
  area_name VARCHAR(200) NOT NULL DEFAULT '',
  district_name VARCHAR(200) NOT NULL DEFAULT '',
  city_name VARCHAR(200) NOT NULL DEFAULT '',
  province_name VARCHAR(200) NOT NULL DEFAULT '',
  area_id VARCHAR(32) NULL,
  zipcode VARCHAR(20) NOT NULL,
  coordinate VARCHAR(80) NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  default_key VARCHAR(16) GENERATED ALWAYS AS (IF(is_default, 'default', NULL)) STORED,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_warehouses_default (default_key),
  INDEX idx_warehouses_active_default (is_active, is_default, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS warehouse_inventory (
  warehouse_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (warehouse_id, product_id),
  CONSTRAINT chk_warehouse_inventory_stock CHECK (stock >= 0),
  CONSTRAINT fk_warehouse_inventory_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
  CONSTRAINT fk_warehouse_inventory_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_warehouse_inventory_product (product_id, stock)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  status ENUM('pending_payment', 'payment_review', 'paid', 'processing', 'shipped', 'delivered', 'returned', 'cancelled', 'refunded')
    NOT NULL DEFAULT 'pending_payment',
  subtotal DECIMAL(12, 2) NOT NULL,
  shipping_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL,
  shipping_address VARCHAR(1000) NOT NULL,
  customer_note VARCHAR(1000) NOT NULL DEFAULT '',
  recipient_name VARCHAR(120) NULL,
  recipient_phone VARCHAR(30) NULL,
  shipping_area_id VARCHAR(32) NULL,
  shipping_zipcode VARCHAR(20) NULL,
  shipping_coordinate VARCHAR(80) NULL,
  selected_courier_id INT UNSIGNED NULL,
  selected_service_id INT UNSIGNED NULL,
  selected_courier_name VARCHAR(120) NULL,
  selected_service_name VARCHAR(160) NULL,
  selected_service_category VARCHAR(40) NULL,
  carrier_shipping_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  shipping_subsidy DECIMAL(12, 2) NOT NULL DEFAULT 0,
  shipping_insurance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  shipping_cod_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
  shipping_quote_json JSON NULL,
  warehouse_id CHAR(36) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_orders_amounts CHECK (subtotal >= 0 AND shipping_cost >= 0 AND total >= 0),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_orders_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL,
  INDEX idx_orders_user_created (user_id, created_at DESC),
  INDEX idx_orders_status_created (status, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  product_id CHAR(36) NULL,
  product_name VARCHAR(200) NOT NULL,
  satuan VARCHAR(40) NOT NULL DEFAULT 'unit',
  unit_price DECIMAL(12, 2) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  shipping_weight_gram INT UNSIGNED NULL,
  shipping_length_cm INT UNSIGNED NULL,
  shipping_width_cm INT UNSIGNED NULL,
  shipping_height_cm INT UNSIGNED NULL,
  CONSTRAINT chk_order_items_amounts CHECK (unit_price >= 0 AND quantity > 0 AND line_total >= 0),
  CONSTRAINT chk_order_items_shipping CHECK (
    (shipping_weight_gram IS NULL AND shipping_length_cm IS NULL AND shipping_width_cm IS NULL AND shipping_height_cm IS NULL)
    OR (shipping_weight_gram IS NOT NULL AND shipping_length_cm IS NOT NULL AND shipping_width_cm IS NOT NULL AND shipping_height_cm IS NOT NULL
      AND shipping_weight_gram > 0 AND shipping_length_cm > 0 AND shipping_width_cm > 0 AND shipping_height_cm > 0)
  ),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_order_items_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL UNIQUE,
  provider VARCHAR(30) NOT NULL DEFAULT 'tripay',
  merchant_ref VARCHAR(64) NULL UNIQUE,
  provider_reference VARCHAR(200) NULL,
  status ENUM('pending', 'submitted', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  amount DECIMAL(12, 2) NOT NULL,
  proof_url VARCHAR(1000) NULL,
  payment_url VARCHAR(2000) NULL,
  payment_method VARCHAR(40) NULL,
  payment_code VARCHAR(1000) NULL,
  expires_at DATETIME NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_payments_amount CHECK (amount >= 0),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shipments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL UNIQUE,
  carrier VARCHAR(120) NOT NULL DEFAULT '',
  tracking_number VARCHAR(200) NOT NULL DEFAULT '',
  tracking_url VARCHAR(1000) NOT NULL DEFAULT '',
  shipped_at TIMESTAMP(3) NULL,
  delivered_at TIMESTAMP(3) NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_shipments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_item_id CHAR(36) NOT NULL UNIQUE,
  user_id CHAR(36) NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  body VARCHAR(3000) NOT NULL DEFAULT '',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 6),
  CONSTRAINT fk_reviews_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_reviews_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  order_id CHAR(36) NULL,
  subject VARCHAR(200) NOT NULL DEFAULT 'Customer support',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_conversations_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_conversations_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  INDEX idx_conversations_user (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  conversation_id CHAR(36) NOT NULL,
  sender_id CHAR(36) NOT NULL,
  body VARCHAR(5000) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_messages_body CHECK (CHAR_LENGTH(body) BETWEEN 1 AND 5000),
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id),
  INDEX idx_messages_conversation_created (conversation_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  transaction_type ENUM('credit', 'debit', 'refund', 'adjustment') NOT NULL,
  reference_key VARCHAR(120) NULL UNIQUE,
  description VARCHAR(300) NOT NULL DEFAULT '',
  created_by CHAR(36) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_wallet_nonzero CHECK (amount <> 0),
  CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wallet_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_wallet_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS jubelio_webhook_events (
  dedupe_key CHAR(64) NOT NULL PRIMARY KEY,
  awb VARCHAR(200) NOT NULL,
  payload JSON NOT NULL,
  received_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  processed_at TIMESTAMP(3) NULL,
  processing_error VARCHAR(500) NULL,
  INDEX idx_jubelio_webhook_pending (processed_at, received_at),
  INDEX idx_jubelio_webhook_awb (awb, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admin awal. Password sementara: TempAdmin!Change2026. Segera ganti setelah login pertama.
SET @sample_admin_id = UUID();
INSERT INTO users (id, username, full_name, phone, email, password_hash, role)
SELECT @sample_admin_id, 'admin', 'Administrator Comotrade', NULL, 'admin@comotrade.local',
       '$2b$12$5yoch2dCXdyIp3tARbw/ouvzSRM.5yPgo/CRz8cnZC/1R0WMr2yfm', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin' OR email = 'admin@comotrade.local');

SET @sample_admin_id = (SELECT id FROM users WHERE username = 'admin' LIMIT 1);

-- Contoh produk; masing-masing stok satu unit dan sudah memiliki atribut pengiriman.
INSERT INTO products (
  id, slug, name, category, description, price, stock, satuan,
  shipping_weight_gram, shipping_length_cm, shipping_width_cm, shipping_height_cm,
  origin, image_url, created_by
)
SELECT UUID(), 'cabai-kering', 'Cabai Kering', 'Rempah',
       'Cabai kering pilihan Nusantara. Harga contoh per kilogram.', 50000, 1, 'kg',
       1000, 20, 15, 10, 'Indonesia', '/Pictures/rempah/cabai%20kering.webp', @sample_admin_id
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'cabai-kering');

INSERT INTO products (
  id, slug, name, category, description, price, stock, satuan,
  shipping_weight_gram, shipping_length_cm, shipping_width_cm, shipping_height_cm,
  origin, image_url, created_by
)
SELECT UUID(), 'cengkeh', 'Cengkeh', 'Rempah',
       'Cengkeh kering pilihan. Harga contoh per kilogram.', 85000, 1, 'kg',
       1000, 18, 12, 8, 'Indonesia', '/Pictures/rempah/cengkeh.webp', @sample_admin_id
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'cengkeh');

INSERT INTO products (
  id, slug, name, category, description, price, stock, satuan,
  shipping_weight_gram, shipping_length_cm, shipping_width_cm, shipping_height_cm,
  origin, image_url, created_by
)
SELECT UUID(), 'arang-briket-kubus', 'Arang Briket Kubus', 'Kerajinan',
       'Arang briket kubus untuk kebutuhan rumah tangga dan usaha.', 45000, 1, 'pcs',
       1200, 22, 16, 10, 'Indonesia', '/Pictures/Kerajinan/Arang%20Briket%20kubus.webp', @sample_admin_id
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'arang-briket-kubus');

-- Tandai baseline schema untuk migration runner Comotrade.
INSERT IGNORE INTO schema_migrations (name) VALUES ('001_marketplace.sql'), ('002_username_phone_product_unit.sql');

CREATE TABLE IF NOT EXISTS jubelio_shipment_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shipment_attempt_id CHAR(36) NOT NULL,
  event_at DATETIME(3) NOT NULL,
  status_code VARCHAR(80) NOT NULL,
  detail VARCHAR(1000) NULL,
  source ENUM('webhook', 'reconcile', 'manual') NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_jubelio_event_attempt FOREIGN KEY (shipment_attempt_id)
    REFERENCES jubelio_shipment_attempts(id) ON DELETE CASCADE,
  UNIQUE KEY uq_jubelio_event_dedup (shipment_attempt_id, status_code, event_at),
  INDEX idx_jubelio_events_attempt_time (shipment_attempt_id, event_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS jubelio_shipment_attempts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  attempt_no INT UNSIGNED NOT NULL,
  state ENUM('CREATING', 'CREATED', 'UNKNOWN', 'FAILED', 'CANCELED') NOT NULL,
  active_order_id CHAR(36) GENERATED ALWAYS AS (
    CASE WHEN state IN ('CREATING', 'CREATED', 'UNKNOWN') THEN order_id ELSE NULL END
  ) STORED,
  awb VARCHAR(200) NULL UNIQUE,
  jubelio_shipment_id BIGINT UNSIGNED NULL,
  courier_id INT UNSIGNED NULL,
  service_id INT UNSIGNED NULL,
  courier_name VARCHAR(120) NOT NULL DEFAULT '',
  service_name VARCHAR(160) NOT NULL DEFAULT '',
  carrier_price DECIMAL(12, 2) NULL,
  price_drift DECIMAL(12, 2) NULL,
  jubelio_status VARCHAR(40) NULL,
  last_event_at DATETIME(3) NULL,
  tracking_url VARCHAR(1000) NULL,
  proof_json JSON NULL,
  error_code VARCHAR(80) NULL,
  error_message VARCHAR(500) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_jubelio_attempt_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  UNIQUE KEY uq_jubelio_attempt_order_no (order_id, attempt_no),
  UNIQUE KEY uq_jubelio_attempt_active_order (active_order_id),
  INDEX idx_jubelio_attempt_state_updated (state, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_addresses (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  label VARCHAR(60) NOT NULL DEFAULT 'Rumah',
  recipient_name VARCHAR(120) NOT NULL,
  recipient_phone VARCHAR(30) NOT NULL,
  address_line VARCHAR(1000) NOT NULL,
  area_name VARCHAR(200) NOT NULL DEFAULT '',
  district_name VARCHAR(200) NOT NULL DEFAULT '',
  city_name VARCHAR(200) NOT NULL DEFAULT '',
  province_name VARCHAR(200) NOT NULL DEFAULT '',
  area_id VARCHAR(32) NOT NULL,
  zipcode VARCHAR(20) NOT NULL,
  coordinate VARCHAR(80) NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  default_user_id CHAR(36) GENERATED ALWAYS AS (CASE WHEN is_default THEN user_id ELSE NULL END) STORED,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_user_addresses_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_user_addresses_single_default (default_user_id),
  INDEX idx_user_addresses_user (user_id, is_default, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;