use CLAUDE_PROJECTS;

-- One-time upgrade for databases that have already applied 001_marketplace.sql.
-- Existing user/product/order rows are retained. Existing products and order items
-- receive the backward-compatible default unit "unit".
ALTER TABLE users
  ADD COLUMN username VARCHAR(32) NULL AFTER id,
  ADD COLUMN phone VARCHAR(30) NULL AFTER full_name;

UPDATE users
SET username = LOWER(CONCAT('user_', LEFT(REPLACE(id, '-', ''), 12)))
WHERE username IS NULL OR TRIM(username) = '';

ALTER TABLE users
  MODIFY username VARCHAR(32) NOT NULL,
  ADD UNIQUE INDEX uq_users_username (username);

ALTER TABLE products
  ADD COLUMN satuan VARCHAR(40) NOT NULL DEFAULT 'unit' AFTER stock;

ALTER TABLE order_items
  ADD COLUMN satuan VARCHAR(40) NOT NULL DEFAULT 'unit' AFTER product_name;
