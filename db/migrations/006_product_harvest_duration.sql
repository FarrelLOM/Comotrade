USE CLAUDE_PROJECTS;

-- Adds optional harvest/production lead-time text without changing existing products.
ALTER TABLE products
  ADD COLUMN harvest_duration VARCHAR(120) NULL AFTER long_description;