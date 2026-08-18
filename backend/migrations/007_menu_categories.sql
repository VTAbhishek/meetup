-- ============================================================
--  Migration 007 — Menu categories table
-- ============================================================

CREATE TABLE IF NOT EXISTS `menu_categories` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `name`       VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_menu_category_name` (`name`)
) ENGINE=InnoDB;

INSERT IGNORE INTO `menu_categories` (`name`) VALUES
('Kottu'),
('Rice'),
('Drinks'),
('Desserts'),
('Appetizers');
