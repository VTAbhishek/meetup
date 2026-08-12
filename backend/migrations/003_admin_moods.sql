-- ============================================================
--  Migration 003 — moods become admin-managed
--
--  Run once against an existing `meetup` database:
--      mysql -u root --default-character-set=utf8mb4 meetup < backend/migrations/003_admin_moods.sql
--
--  The `moods` table itself already exists (migration 002). Nothing about its
--  shape changes — the admin panel just writes to it now. What this migration
--  does is repair rows written by an earlier import and make sure the table can
--  hold the text the editor accepts.
-- ============================================================

-- ---- Repair mis-encoded seed text ---------------------------
--  The 002 seed was imported through a client using the Windows console code
--  page, so the em dashes landed as "ÔÇö" and are shown that way on the
--  business dashboard. Rewrite them from the slug, which was pure ASCII and so
--  came through intact. Safe to re-run: rows already correct don't match.
UPDATE `moods`
   SET `hint` = 'Open late - good for a night out'
 WHERE `slug` = 'late-night' AND `hint` NOT LIKE 'Open late - %';

UPDATE `moods`
   SET `hint` = 'Room for a crowd - birthdays and parties'
 WHERE `slug` = 'celebration' AND `hint` NOT LIKE 'Room for a crowd - %';

-- ---- Make the vocabulary safe to extend ---------------------
--  Admins add moods by name now, so two moods sharing a name would render as
--  two identical chips. The API rejects duplicates; this backs it at the table.
--  (Wrapped so re-running against a database that already has the key is a
--  no-op rather than an error.)
SET @has_key = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'moods' AND INDEX_NAME = 'uq_mood_name'
);
SET @sql = IF(@has_key = 0,
  'ALTER TABLE `moods` ADD UNIQUE KEY `uq_mood_name` (`name`)',
  'SELECT "uq_mood_name already present" AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
