-- Gudang fulfillment dan stok per lokasi. Data order dan stok produk lama tetap dipertahankan.
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
