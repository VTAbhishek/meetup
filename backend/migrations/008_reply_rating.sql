-- Migration 008: Add rating (star rating) to review replies
-- Apply via:
--      mysql -u root meetup < backend/migrations/008_reply_rating.sql

ALTER TABLE `review_replies` ADD COLUMN `rating` INT DEFAULT NULL;
