use CLAUDE_PROJECTS;

-- Jalankan SEKALI pada database MySQL Comotrade setelah backup.
-- Tidak menghapus tabel/baris. Produk lama mendapat NULL pada atribut paket dan
-- tidak dapat dipakai checkout kurir sampai berat gram serta dimensi cm diisi admin.

ALTER TABLE products
  ADD COLUMN shipping_weight_gram INT UNSIGNED NULL,
  ADD COLUMN shipping_length_cm INT UNSIGNED NULL,
  ADD COLUMN shipping_width_cm INT UNSIGNED NULL,
  ADD COLUMN shipping_height_cm INT UNSIGNED NULL;

ALTER TABLE order_items
  ADD COLUMN shipping_weight_gram INT UNSIGNED NULL,
  ADD COLUMN shipping_length_cm INT UNSIGNED NULL,
  ADD COLUMN shipping_width_cm INT UNSIGNED NULL,
  ADD COLUMN shipping_height_cm INT UNSIGNED NULL;

ALTER TABLE orders
  MODIFY COLUMN status ENUM('pending_payment', 'payment_review', 'paid', 'processing', 'shipped', 'delivered', 'returned', 'cancelled', 'refunded')
    NOT NULL DEFAULT 'pending_payment',
  ADD COLUMN recipient_name VARCHAR(120) NULL,
  ADD COLUMN recipient_phone VARCHAR(30) NULL,
  ADD COLUMN shipping_area_id VARCHAR(32) NULL,
  ADD COLUMN shipping_zipcode VARCHAR(20) NULL,
  ADD COLUMN shipping_coordinate VARCHAR(80) NULL,
  ADD COLUMN selected_courier_id INT UNSIGNED NULL,
  ADD COLUMN selected_service_id INT UNSIGNED NULL,
  ADD COLUMN selected_courier_name VARCHAR(120) NULL,
  ADD COLUMN selected_service_name VARCHAR(160) NULL,
  ADD COLUMN selected_service_category VARCHAR(40) NULL,
  ADD COLUMN carrier_shipping_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN shipping_subsidy DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN shipping_insurance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN shipping_cod_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN shipping_quote_json JSON NULL;

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
  CONSTRAINT fk_user_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_addresses_single_default (default_user_id),
  INDEX idx_user_addresses_user (user_id, is_default, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Saldo wallet pelanggan adalah ledger Comotrade, BUKAN saldo Jubelio Wallet milik toko.
-- amount positif = kredit, negatif = debit; semua perubahan wajib berasal dari backend tepercaya.
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

-- Tiap percobaan AWB dipertahankan. Kolom generated memastikan maksimal satu percobaan aktif
-- (CREATING/CREATED/UNKNOWN) per order walaupun aplikasi berjalan di beberapa instance.
CREATE TABLE IF NOT EXISTS jubelio_shipment_attempts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  attempt_no INT UNSIGNED NOT NULL,
  state ENUM('CREATING', 'CREATED', 'UNKNOWN', 'FAILED', 'CANCELED') NOT NULL,
  active_order_id CHAR(36) GENERATED ALWAYS AS (
    CASE WHEN state IN ('CREATING', 'CREATED', 'UNKNOWN') THEN order_id ELSE NULL END
  ) STORED,
  awb VARCHAR(200) NULL,
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
  UNIQUE KEY uq_jubelio_attempt_awb (awb),
  INDEX idx_jubelio_attempt_state_updated (state, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- Hanya payload yang sudah lulus signature boleh masuk tabel ini.
-- Event yang belum punya AWB lokal tetap pending dan dapat diproses setelah shipment tersimpan.
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
