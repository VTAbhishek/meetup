-- ============================================================
--  Migration 004 — a printable QR code per table
--
--  Run once against an existing `meetup` database:
--      mysql -u root --default-character-set=utf8mb4 meetup < backend/migrations/004_table_qr.sql
--
--  Each table gets a `qr_token`: a random, unguessable string that the printed
--  QR code carries. Scanning the code opens the company's reservation page with
--  that table already picked.
--
--  The token is deliberately NOT the table id. Ids are sequential, so a printed
--  card would advertise how many tables exist and invite guessing at the others.
--  Every statement is idempotent.
-- ============================================================

-- ---- The token column --------------------------------------
SET @has_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_tables' AND COLUMN_NAME = 'qr_token'
);
SET @sql = IF(@has_col = 0,
  'ALTER TABLE `company_tables` ADD COLUMN `qr_token` VARCHAR(32) DEFAULT NULL AFTER `image`',
  'SELECT "qr_token already present" AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- Backfill tables created before this feature ------------
--  32 hex chars, the same shape the PHP side generates. UUID() is evaluated per
--  row and is unique by construction, and unlike RANDOM_BYTES() it exists on
--  both MariaDB (XAMPP) and MySQL. Re-running finds nothing left to fill.
UPDATE `company_tables`
   SET `qr_token` = LOWER(REPLACE(UUID(), '-', ''))
 WHERE `qr_token` IS NULL OR `qr_token` = '';

-- ---- One token, one table ----------------------------------
SET @has_key = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_tables' AND INDEX_NAME = 'uq_table_qr_token'
);
SET @sql = IF(@has_key = 0,
  'ALTER TABLE `company_tables` ADD UNIQUE KEY `uq_table_qr_token` (`qr_token`)',
  'SELECT "uq_table_qr_token already present" AS note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
