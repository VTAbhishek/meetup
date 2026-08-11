-- ============================================================
--  LIVE UPDATE — run once on the production database
--
--  Combines migrations 001 (map pin + bookable tables) and 002 (mood tags)
--  into a single script for phpMyAdmin.
--
--  HOW TO RUN (cPanel):
--    1. phpMyAdmin -> click your database in the LEFT sidebar first
--       (its real name is prefixed, e.g. `cpaneluser_meetup`)
--    2. SQL tab -> paste this whole file -> Go
--
--  There is deliberately no "USE <database>" line, so this runs against
--  whichever database you have selected.
--
--  Safe to run more than once: every statement checks first, so a second
--  run changes nothing. Works on MySQL 5.7+, MySQL 8 and MariaDB — the
--  column checks avoid "ADD COLUMN IF NOT EXISTS", which is MariaDB-only.
-- ============================================================


-- ============================================================
--  1. companies — map pin
-- ============================================================

SET @s := (SELECT IF((SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'latitude') = 0,
  'ALTER TABLE `companies` ADD COLUMN `latitude` DECIMAL(10,7) NULL DEFAULT NULL', 'DO 0'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := (SELECT IF((SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'longitude') = 0,
  'ALTER TABLE `companies` ADD COLUMN `longitude` DECIMAL(10,7) NULL DEFAULT NULL', 'DO 0'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := (SELECT IF((SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'map_zoom') = 0,
  'ALTER TABLE `companies` ADD COLUMN `map_zoom` TINYINT UNSIGNED NOT NULL DEFAULT 16', 'DO 0'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;


-- ============================================================
--  2. company_tables — bookable tables
--     Created before the reservations foreign key that points at it.
-- ============================================================

CREATE TABLE IF NOT EXISTS `company_tables` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `category`   VARCHAR(60)  NOT NULL,          -- e.g. VIP, Family, Couple
  `table_no`   VARCHAR(30)  NOT NULL,          -- e.g. T-12
  `seats`      INT NOT NULL DEFAULT 2,
  `note`       VARCHAR(200) DEFAULT NULL,
  `image`      VARCHAR(255) DEFAULT NULL,
  `is_active`  TINYINT(1) NOT NULL DEFAULT 1,  -- off = hidden from customers
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_company_table_no` (`company_id`,`table_no`),
  KEY `idx_company` (`company_id`),
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ============================================================
--  3. reservations — which table was booked
--     table_label snapshots "VIP · T-12" so an old booking still reads
--     correctly after the table is renamed or deleted.
-- ============================================================

SET @s := (SELECT IF((SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'table_id') = 0,
  'ALTER TABLE `reservations` ADD COLUMN `table_id` INT NULL DEFAULT NULL', 'DO 0'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := (SELECT IF((SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'table_label') = 0,
  'ALTER TABLE `reservations` ADD COLUMN `table_label` VARCHAR(100) NULL DEFAULT NULL', 'DO 0'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := (SELECT IF((SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'idx_table') = 0,
  'ALTER TABLE `reservations` ADD KEY `idx_table` (`table_id`)', 'DO 0'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := (SELECT IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations'
      AND CONSTRAINT_NAME = 'fk_reservation_table' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 0,
  'ALTER TABLE `reservations` ADD CONSTRAINT `fk_reservation_table`
     FOREIGN KEY (`table_id`) REFERENCES `company_tables`(`id`) ON DELETE SET NULL', 'DO 0'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;


-- ============================================================
--  4. moods — the mood vocabulary and the companies that claim them
-- ============================================================

CREATE TABLE IF NOT EXISTS `moods` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `slug`       VARCHAR(60) NOT NULL,          -- stable key used in URLs
  `name`       VARCHAR(80) NOT NULL,          -- shown to users
  `hint`       VARCHAR(160) DEFAULT NULL,
  `icon`       VARCHAR(40)  DEFAULT NULL,     -- lucide icon name
  `sort_order` INT NOT NULL DEFAULT 0,
  UNIQUE KEY `uq_mood_slug` (`slug`)
) ENGINE=InnoDB;

INSERT INTO `moods` (`slug`,`name`,`hint`,`icon`,`sort_order`) VALUES
  ('family-outing',   'Family short outing',     'Relaxed, kid-friendly, easy for a short family trip', 'Users',       1),
  ('quick-bite',      'Quick bite with friends', 'Fast, casual, good for a short catch-up',             'Sandwich',    2),
  ('late-night',      'Late night spot',         'Open late - good for a night out',                    'Moon',        3),
  ('romantic',        'Romantic date',           'Quiet and intimate, good for two',                    'Heart',       4),
  ('work-friendly',   'Work or study friendly',  'Calm, with space to sit and work',                    'Laptop',      5),
  ('celebration',     'Big group celebration',   'Room for a crowd - birthdays and parties',            'PartyPopper', 6)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`), `hint` = VALUES(`hint`),
  `icon` = VALUES(`icon`), `sort_order` = VALUES(`sort_order`);

CREATE TABLE IF NOT EXISTS `company_moods` (
  `company_id` INT NOT NULL,
  `mood_id`    INT NOT NULL,
  PRIMARY KEY (`company_id`,`mood_id`),
  KEY `idx_mood` (`mood_id`),
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`mood_id`)    REFERENCES `moods`(`id`)     ON DELETE CASCADE
) ENGINE=InnoDB;


-- ============================================================
--  5. Check it worked — every row below should read OK
-- ============================================================
SELECT 'companies.latitude'      AS item, IF(COUNT(*) = 1, 'OK', 'MISSING') AS status FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'latitude'
UNION ALL SELECT 'companies.longitude',   IF(COUNT(*) = 1, 'OK', 'MISSING') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'longitude'
UNION ALL SELECT 'companies.map_zoom',    IF(COUNT(*) = 1, 'OK', 'MISSING') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'map_zoom'
UNION ALL SELECT 'reservations.table_id', IF(COUNT(*) = 1, 'OK', 'MISSING') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'table_id'
UNION ALL SELECT 'reservations.table_label', IF(COUNT(*) = 1, 'OK', 'MISSING') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'table_label'
UNION ALL SELECT 'table company_tables',  IF(COUNT(*) = 1, 'OK', 'MISSING') FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_tables'
UNION ALL SELECT 'table moods',           IF(COUNT(*) = 1, 'OK', 'MISSING') FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'moods'
UNION ALL SELECT 'table company_moods',   IF(COUNT(*) = 1, 'OK', 'MISSING') FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_moods'
UNION ALL SELECT 'mood rows (want 6)',    IF(COUNT(*) = 6, 'OK', CONCAT('GOT ', COUNT(*))) FROM `moods`;
