-- ============================================================
--  Meetup Review Platform - Database Schema
--  Import this in phpMyAdmin (creates the `meetup` database)
-- ============================================================

CREATE DATABASE IF NOT EXISTS `meetup`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `meetup`;

-- ------------------------------------------------------------
--  Unified accounts table for all 3 user types
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `user_type`          ENUM('customer','company','admin') NOT NULL,
  `full_name`          VARCHAR(150) NOT NULL,
  `username`           VARCHAR(60)  NOT NULL,
  `email`              VARCHAR(190) NOT NULL,
  `dial_code`          VARCHAR(6)  DEFAULT NULL,   -- country code, e.g. +94
  `mobile`             VARCHAR(20) DEFAULT NULL,   -- 10-digit mobile number
  `password`           VARCHAR(255) NOT NULL,
  `is_verified`        TINYINT(1) NOT NULL DEFAULT 0,  -- 1 once mobile OTP passes
  `verification_token` VARCHAR(64) DEFAULT NULL,
  `reset_token`        VARCHAR(64) DEFAULT NULL,
  `reset_expires`      DATETIME DEFAULT NULL,
  `status`             ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_username` (`username`),
  UNIQUE KEY `uq_email` (`email`)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  Bearer tokens for API auth (1 row per active session)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `auth_tokens` (
  `token`      CHAR(64) NOT NULL PRIMARY KEY,
  `user_id`    INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_user` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  Mobile OTP codes (registration verification)
--  A code is valid for 5 min; resend is throttled to 30s (enforced in PHP).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `otp_codes` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT NOT NULL,
  `mobile`      VARCHAR(20) NOT NULL,
  `purpose`     VARCHAR(20) NOT NULL DEFAULT 'register',
  `code`        VARCHAR(6)  NOT NULL,
  `attempts`    TINYINT NOT NULL DEFAULT 0,
  `expires_at`  DATETIME NOT NULL,
  `consumed_at` DATETIME DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_user` (`user_id`),
  KEY `idx_mobile` (`mobile`),
  KEY `idx_lookup` (`user_id`,`purpose`,`consumed_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  Company profiles (1 row per company user)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `companies` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`      INT NOT NULL,
  `company_name` VARCHAR(190) NOT NULL,
  `website`      VARCHAR(190) DEFAULT NULL,
  `phone`        VARCHAR(40)  DEFAULT NULL,
  `category`     VARCHAR(100) DEFAULT NULL,
  `district_id`  INT DEFAULT NULL,   -- FK -> districts.id (set at registration)
  `city_id`      INT DEFAULT NULL,   -- FK -> cities.id

  `address`      VARCHAR(255) DEFAULT NULL,
  `description`  TEXT DEFAULT NULL,
  `logo`         VARCHAR(255) DEFAULT NULL,
  `cover_video`  VARCHAR(255) DEFAULT NULL,  -- optional auto-generated cover montage (webm/mp4)
  `is_approved`  TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  Districts (fixed list of Sri Lanka's 25 districts)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `districts` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `name`       VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_district` (`name`)
) ENGINE=InnoDB;

INSERT IGNORE INTO `districts` (`name`) VALUES
('Ampara'),('Anuradhapura'),('Badulla'),('Batticaloa'),('Colombo'),
('Galle'),('Gampaha'),('Hambantota'),('Jaffna'),('Kalutara'),
('Kandy'),('Kegalle'),('Kilinochchi'),('Kurunegala'),('Mannar'),
('Matale'),('Matara'),('Monaragala'),('Mullaitivu'),('Nuwara Eliya'),
('Polonnaruwa'),('Puttalam'),('Ratnapura'),('Trincomalee'),('Vavuniya');

-- ------------------------------------------------------------
--  Cities (each belongs to a district; managed from the admin panel)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cities` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `district_id` INT NOT NULL,
  `name`        VARCHAR(120) NOT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_city` (`district_id`,`name`),
  KEY `idx_district` (`district_id`),
  FOREIGN KEY (`district_id`) REFERENCES `districts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  Showcase cards (public-page tiles; click reveals the 2nd image)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `company_cards` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `title`      VARCHAR(100) NOT NULL,
  `intro`      VARCHAR(300) DEFAULT NULL,
  `thumb`      VARCHAR(255) NOT NULL,
  `image`      VARCHAR(255) DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  Opening hours: weekly schedule + per-date (today) overrides
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `company_hours` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `weekday`    TINYINT NOT NULL,           -- 0=Sunday … 6=Saturday
  `is_open`    TINYINT(1) NOT NULL DEFAULT 1,
  `open_time`  TIME DEFAULT NULL,
  `close_time` TIME DEFAULT NULL,
  UNIQUE KEY `uq_company_day` (`company_id`,`weekday`),
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `company_hour_overrides` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `date`       DATE NOT NULL,
  `is_open`    TINYINT(1) NOT NULL DEFAULT 1,
  `open_time`  TIME DEFAULT NULL,
  `close_time` TIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_company_date` (`company_id`,`date`),
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  Reviews left by customers on companies
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reviews` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `company_id`  INT NOT NULL,
  `rating`      TINYINT NOT NULL,
  `title`       VARCHAR(190) DEFAULT NULL,
  `body`        TEXT NOT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`)     ON DELETE CASCADE,
  FOREIGN KEY (`company_id`)  REFERENCES `companies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  Company replies to reviews
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `review_replies` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `review_id`  INT NOT NULL,
  `company_id` INT NOT NULL,
  `body`       TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`review_id`)  REFERENCES `reviews`(`id`)    ON DELETE CASCADE,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  Reservations / bookings a customer makes with a company
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reservations` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `company_id`   INT NOT NULL,
  `customer_id`  INT NOT NULL,
  `name`         VARCHAR(150) NOT NULL,
  `mobile`       VARCHAR(30)  NOT NULL,
  `res_date`     DATE NOT NULL,
  `time_from`    TIME NOT NULL,
  `time_to`      TIME NOT NULL,
  `person_count` INT NOT NULL DEFAULT 1,
  `description`  TEXT DEFAULT NULL,
  `status`       ENUM('pending','confirmed') NOT NULL DEFAULT 'pending',
  `reply`        TEXT DEFAULT NULL,   -- company's message back to the customer
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_company` (`company_id`),
  KEY `idx_customer` (`customer_id`),
  FOREIGN KEY (`company_id`)  REFERENCES `companies`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`)     ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  In-app notifications (e.g. a company's reply to a reservation).
--  Dismissed by deleting the row when the user opens it.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`    INT NOT NULL,           -- recipient
  `type`       VARCHAR(30) NOT NULL DEFAULT 'reservation',
  `title`      VARCHAR(190) NOT NULL,
  `body`       TEXT DEFAULT NULL,
  `link`       VARCHAR(190) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_user` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  Payments made by companies
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `amount`     DECIMAL(10,2) NOT NULL,
  `reference`  VARCHAR(100) DEFAULT NULL,
  `status`     ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  Menu items: a company's food/drink list for customer pre-ordering.
--  Each item can be switched off (is_available = 0) when unavailable.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `menu_items` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `company_id`   INT NOT NULL,
  `category`     VARCHAR(80) NOT NULL,
  `name`         VARCHAR(120) NOT NULL,
  `price`        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `image`        VARCHAR(255) DEFAULT NULL,
  `is_available` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order`   INT NOT NULL DEFAULT 0,
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `company_id` (`company_id`),
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  Reservation items: food pre-ordered with a reservation. Name + price are
--  snapshotted at order time so later menu edits don't change past orders.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reservation_items` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `reservation_id` INT NOT NULL,
  `menu_item_id`   INT DEFAULT NULL,
  `name`           VARCHAR(120) NOT NULL,
  `price`          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `qty`            INT NOT NULL DEFAULT 1,
  KEY `reservation_id` (`reservation_id`),
  FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  Seed a default admin account
--  Login username: admin   Password: admin123
--  (Change this password after first login.)
-- ------------------------------------------------------------
INSERT INTO `users` (`user_type`,`full_name`,`username`,`email`,`password`,`is_verified`,`status`)
VALUES ('admin','Site Administrator','admin','admin@company.test',
        '$2y$10$uQJwtFSMAmiyeQgszEPCZeBvxxRADkbkciR/uZBhJfgQZdTPG0E4i',
        1,'active')
ON DUPLICATE KEY UPDATE `email` = `email`;
