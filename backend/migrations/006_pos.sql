-- ============================================================
--  006 — POS / Billing
--  Per-company product catalogue and invoices. Every company that
--  registers automatically gets its own (empty) POS: rows here are
--  always scoped by company_id, so there is nothing to provision.
-- ============================================================

-- Products the company sells at the counter (separate from menu_items,
-- which are the customer-facing pre-order menu). Has SKU + stock.
CREATE TABLE IF NOT EXISTS `pos_products` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `name`       VARCHAR(150) NOT NULL,
  `sku`        VARCHAR(60)  DEFAULT NULL,
  `price`      DECIMAL(12,2) NOT NULL DEFAULT 0,
  `stock`      INT NOT NULL DEFAULT 0,
  `is_active`  TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_pos_products_company` (`company_id`),
  UNIQUE KEY `uq_pos_products_sku` (`company_id`, `sku`),
  CONSTRAINT `fk_pos_products_company` FOREIGN KEY (`company_id`)
    REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pos_invoices` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `company_id`    INT NOT NULL,
  `invoice_no`    VARCHAR(40) NOT NULL,
  `customer_name` VARCHAR(150) NOT NULL DEFAULT 'Walk-in',
  `user_id`       INT DEFAULT NULL,          -- staff account that rang it up
  `subtotal`      DECIMAL(12,2) NOT NULL DEFAULT 0,
  `discount`      DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total`         DECIMAL(12,2) NOT NULL DEFAULT 0,
  `paid`          DECIMAL(12,2) NOT NULL DEFAULT 0,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Composite so a company's daily/date-range reports stay fast even with
  -- millions of invoices: MySQL filters by company_id then created_at on one
  -- index, and company_id-only lookups still use it (leftmost prefix).
  KEY `idx_pos_invoices_company_date` (`company_id`, `created_at`),
  UNIQUE KEY `uq_pos_invoice_no` (`company_id`, `invoice_no`),
  CONSTRAINT `fk_pos_invoices_company` FOREIGN KEY (`company_id`)
    REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pos_invoice_items` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_id`   INT NOT NULL,
  `product_id`   INT DEFAULT NULL,           -- kept even if product later deleted
  `product_name` VARCHAR(150) NOT NULL,
  `price`        DECIMAL(12,2) NOT NULL,
  `qty`          INT NOT NULL,
  `line_total`   DECIMAL(12,2) NOT NULL,
  KEY `idx_pos_items_invoice` (`invoice_id`),
  CONSTRAINT `fk_pos_items_invoice` FOREIGN KEY (`invoice_id`)
    REFERENCES `pos_invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
