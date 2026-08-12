-- ============================================================
--  LIVE UPDATE 2 — run once on the production database
--
--  Everything added after the first `live_update.sql`:
--    · migration 003 — moods become admin-managed
--    · migration 004 — a printable QR code per table
--    · migration 005 — dine-in orders placed from a table's QR code
--
--  HOW TO RUN (cPanel):
--    1. phpMyAdmin -> click your database in the LEFT sidebar first
--       (its real name is prefixed, e.g. `cpaneluser_meetup`)
--    2. SQL tab -> paste this whole file -> Go
--
--  Run `live_update.sql` first if you haven't: this script assumes
--  `company_tables` and `moods` already exist.
--
--  There is deliberately no "USE <database>" line, so this runs against
--  whichever database you have selected.
--
--  Safe to run more than once: every statement checks first, so a second
--  run changes nothing. Works on MySQL 5.7+, MySQL 8 and MariaDB — the
--  column checks avoid "ADD COLUMN IF NOT EXISTS" (MariaDB-only), and the
--  backfill uses UUID() rather than RANDOM_BYTES() (MySQL 8-only).
-- ============================================================


-- ============================================================
--  1. moods — repair mis-encoded seed text
--
--  The original seed was imported through a client using the Windows
--  console code page, so its em dashes may have landed as "ÔÇö" and are
--  shown that way on the business dashboard. Rewrite those two hints from
--  the slug, which was pure ASCII and came through intact.
--
--  Rows that are already correct do not match, so this is safe to re-run
--  and safe on a database that was never affected.
-- ============================================================

UPDATE `moods`
   SET `hint` = 'Open late - good for a night out'
 WHERE `slug` = 'late-night' AND `hint` NOT LIKE 'Open late - %';

UPDATE `moods`
   SET `hint` = 'Room for a crowd - birthdays and parties'
 WHERE `slug` = 'celebration' AND `hint` NOT LIKE 'Room for a crowd - %';


-- ============================================================
--  2. moods — one name, one mood
--
--  Admins now add moods by name from the control panel, so two moods
--  sharing a name would render as two identical chips. The API rejects
--  duplicates; this backs it at the table.
--
--  The key is only added when the data allows it: if the live database
--  somehow already holds two moods with the same name, adding it would
--  abort the whole script. In that case this step is skipped and the
--  check at the bottom reports DUPLICATE NAMES so it can be cleaned up
--  by hand.
-- ============================================================

SET @dupe_names := (SELECT COUNT(*) FROM (
  SELECT `name` FROM `moods` GROUP BY `name` HAVING COUNT(*) > 1
) AS d);

SET @s := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'moods' AND INDEX_NAME = 'uq_mood_name') = 0
  AND @dupe_names = 0,
  'ALTER TABLE `moods` ADD UNIQUE KEY `uq_mood_name` (`name`)', 'DO 0'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;


-- ============================================================
--  3. company_tables — the token behind each table's QR code
--
--  Scanning a table's printed card opens the ordering page for that exact
--  table. The token is deliberately NOT the table id: ids are sequential,
--  so a printed card would advertise how many tables exist and invite
--  guessing at the others.
-- ============================================================

SET @s := (SELECT IF((SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_tables' AND COLUMN_NAME = 'qr_token') = 0,
  'ALTER TABLE `company_tables` ADD COLUMN `qr_token` VARCHAR(32) DEFAULT NULL AFTER `image`', 'DO 0'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

--  Give every table created before this feature a token. UUID() is
--  evaluated per row and is unique by construction. Re-running finds
--  nothing left to fill.
UPDATE `company_tables`
   SET `qr_token` = LOWER(REPLACE(UUID(), '-', ''))
 WHERE `qr_token` IS NULL OR `qr_token` = '';

SET @s := (SELECT IF((SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_tables' AND INDEX_NAME = 'uq_table_qr_token') = 0,
  'ALTER TABLE `company_tables` ADD UNIQUE KEY `uq_table_qr_token` (`qr_token`)', 'DO 0'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;


-- ============================================================
--  4. orders — dine-in orders from a table's QR code
--
--  Not reservations: there is no date or time to pick (the guest is at the
--  table now), no account is needed, and the kitchen tracks a different
--  set of states.
-- ============================================================

CREATE TABLE IF NOT EXISTS `orders` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `ref`         VARCHAR(8)  NOT NULL,          -- short code staff read out, e.g. K7Q4
  `track_token` VARCHAR(32) NOT NULL,          -- what the guest's browser polls with
  `company_id`  INT NOT NULL,
  `table_id`    INT DEFAULT NULL,              -- nulled if the table is deleted
  `table_label` VARCHAR(100) DEFAULT NULL,     -- "VIP · T-12" at order time
  `customer_id` INT DEFAULT NULL,              -- set only if a logged-in customer ordered
  `name`        VARCHAR(150) DEFAULT NULL,
  `mobile`      VARCHAR(30)  DEFAULT NULL,
  `people`      INT NOT NULL DEFAULT 1,
  `note`        VARCHAR(300) DEFAULT NULL,
  `total`       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status`      ENUM('placed','preparing','served','cancelled') NOT NULL DEFAULT 'placed',
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_order_ref`   (`ref`),
  UNIQUE KEY `uq_order_track` (`track_token`),
  KEY `idx_order_company` (`company_id`,`status`),
  FOREIGN KEY (`company_id`)  REFERENCES `companies`(`id`)      ON DELETE CASCADE,
  FOREIGN KEY (`table_id`)    REFERENCES `company_tables`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`)          ON DELETE SET NULL
) ENGINE=InnoDB;

--  Name and price are copied in, not joined: an order must still read
--  correctly after the dish is renamed, repriced or taken off the menu.
CREATE TABLE IF NOT EXISTS `order_items` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `order_id`     INT NOT NULL,
  `menu_item_id` INT DEFAULT NULL,
  `name`         VARCHAR(120) NOT NULL,
  `price`        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `qty`          INT NOT NULL DEFAULT 1,
  KEY `idx_order` (`order_id`),
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ============================================================
--  5. Check it worked — every row below should read OK
-- ============================================================
SELECT 'company_tables.qr_token' AS item, IF(COUNT(*) = 1, 'OK', 'MISSING') AS status
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_tables' AND COLUMN_NAME = 'qr_token'
UNION ALL SELECT 'index uq_table_qr_token', IF(COUNT(*) > 0, 'OK', 'MISSING')
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_tables' AND INDEX_NAME = 'uq_table_qr_token'
UNION ALL SELECT 'tables still without a token', IF(COUNT(*) = 0, 'OK', CONCAT(COUNT(*), ' MISSING'))
  FROM `company_tables` WHERE `qr_token` IS NULL OR `qr_token` = ''
UNION ALL SELECT 'index uq_mood_name', IF(COUNT(*) > 0, 'OK', IF(@dupe_names > 0, 'SKIPPED - DUPLICATE NAMES', 'MISSING'))
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'moods' AND INDEX_NAME = 'uq_mood_name'
--  Both repaired hints are pure ASCII, so any byte beyond ASCII means the
--  mangling is still there. Comparing LENGTH (bytes) with CHAR_LENGTH
--  (characters) spots that without a LIKE, which under the default
--  accent-insensitive collation would match plain letters too.
UNION ALL SELECT 'mood hints repaired', IF(COUNT(*) = 0, 'OK', CONCAT(COUNT(*), ' STILL MANGLED'))
  FROM `moods`
 WHERE `slug` IN ('late-night', 'celebration') AND LENGTH(`hint`) <> CHAR_LENGTH(`hint`)
UNION ALL SELECT 'table orders', IF(COUNT(*) = 1, 'OK', 'MISSING')
  FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
UNION ALL SELECT 'table order_items', IF(COUNT(*) = 1, 'OK', 'MISSING')
  FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items';
