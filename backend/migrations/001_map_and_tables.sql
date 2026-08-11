-- ============================================================
--  Migration 001 — map location + bookable tables
--
--  Run once against an existing `meetup` database:
--      mysql -u root meetup < backend/migrations/001_map_and_tables.sql
--
--  Fresh installs get all of this from database.sql already; every statement
--  here is idempotent (IF NOT EXISTS), so re-running it is harmless.
-- ============================================================

-- ---- Companies: pinned map location -------------------------
--  Set from the business dashboard by dragging a Google Maps pin. NULL until
--  the company pins itself; the customer page only shows a map when both
--  latitude and longitude are present.
ALTER TABLE `companies`
  ADD COLUMN IF NOT EXISTS `latitude`  DECIMAL(10,7) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `longitude` DECIMAL(10,7) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `map_zoom`  TINYINT UNSIGNED NOT NULL DEFAULT 16;

-- ---- Bookable tables ----------------------------------------
--  A company groups its tables into categories (VIP / Family / Couple / …) and
--  gives each one a number and an optional photo. Customers pick a category,
--  then a specific table, in the reservation form.
CREATE TABLE IF NOT EXISTS `company_tables` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `category`   VARCHAR(60)  NOT NULL,          -- e.g. VIP, Family, Couple
  `table_no`   VARCHAR(30)  NOT NULL,          -- e.g. T-12
  `seats`      INT NOT NULL DEFAULT 2,
  `note`       VARCHAR(200) DEFAULT NULL,      -- e.g. "Window side, 2nd floor"
  `image`      VARCHAR(255) DEFAULT NULL,
  `is_active`  TINYINT(1) NOT NULL DEFAULT 1,  -- off = hidden from customers
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_company_table_no` (`company_id`,`table_no`),
  KEY `idx_company` (`company_id`),
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- Reservations: which table was booked -------------------
--  table_id keeps the link (for double-booking checks); table_label snapshots
--  "VIP · T-12" at booking time so an old reservation still reads correctly
--  after the company renames or deletes that table.
ALTER TABLE `reservations`
  ADD COLUMN IF NOT EXISTS `table_id`    INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `table_label` VARCHAR(100) DEFAULT NULL;

-- Index + FK, guarded so a re-run doesn't fail on "duplicate key name".
SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'idx_table'
);
SET @sql := IF(@has_idx = 0, 'ALTER TABLE `reservations` ADD KEY `idx_table` (`table_id`)', 'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @has_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations'
    AND CONSTRAINT_NAME = 'fk_reservation_table' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(@has_fk = 0,
  'ALTER TABLE `reservations` ADD CONSTRAINT `fk_reservation_table` FOREIGN KEY (`table_id`) REFERENCES `company_tables`(`id`) ON DELETE SET NULL',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
