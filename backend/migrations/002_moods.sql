-- ============================================================
--  Migration 002 — mood tags
--
--  Run once against an existing `meetup` database:
--      mysql -u root meetup < backend/migrations/002_moods.sql
--
--  A company ticks the moods it suits ("Family short outing", "Late night
--  spot", …) next to its location; customers filter by one of them after
--  choosing a district and city. Every statement is idempotent.
-- ============================================================

-- ---- The mood vocabulary -----------------------------------
--  A fixed, curated list rather than free text: two venues writing "late
--  night" and "Late Night Spot" would never match the same filter.
CREATE TABLE IF NOT EXISTS `moods` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `slug`       VARCHAR(60) NOT NULL,          -- stable key used in URLs
  `name`       VARCHAR(80) NOT NULL,          -- shown to users
  `hint`       VARCHAR(160) DEFAULT NULL,     -- one-line explanation
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

-- ---- Which moods a company claims --------------------------
CREATE TABLE IF NOT EXISTS `company_moods` (
  `company_id` INT NOT NULL,
  `mood_id`    INT NOT NULL,
  PRIMARY KEY (`company_id`,`mood_id`),
  KEY `idx_mood` (`mood_id`),
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`mood_id`)    REFERENCES `moods`(`id`)     ON DELETE CASCADE
) ENGINE=InnoDB;
