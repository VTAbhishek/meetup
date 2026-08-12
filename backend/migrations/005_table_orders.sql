-- ============================================================
--  Migration 005 — dine-in orders placed from a table's QR code
--
--  Run once against an existing `meetup` database:
--      mysql -u root --default-character-set=utf8mb4 meetup < backend/migrations/005_table_orders.sql
--
--  A guest scans the QR card on their table, picks dishes and sends the order.
--  This is deliberately NOT a reservation: there is no date or time to choose —
--  the guest is sitting at the table now — and the kitchen tracks it through a
--  different set of states. Every statement is idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS `orders` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,

  -- Short code both sides read out loud ("order K7Q4"). Unique so staff can
  -- search it; deliberately short, and drawn from an alphabet with no O/0/I/1.
  `ref`         VARCHAR(8)  NOT NULL,
  -- What the guest's browser polls to watch its own order. Unguessable, so one
  -- table's phone cannot read another's order by trying refs.
  `track_token` VARCHAR(32) NOT NULL,

  `company_id`  INT NOT NULL,
  -- Nulled if the table is later deleted; table_label keeps what was scanned.
  `table_id`    INT DEFAULT NULL,
  `table_label` VARCHAR(100) DEFAULT NULL,
  -- Set only when a logged-in customer ordered. Guests order without an account,
  -- so this stays NULL and `name` / `mobile` are all the company has.
  `customer_id` INT DEFAULT NULL,

  `name`        VARCHAR(150) DEFAULT NULL,
  `mobile`      VARCHAR(30)  DEFAULT NULL,
  `people`      INT NOT NULL DEFAULT 1,
  `note`        VARCHAR(300) DEFAULT NULL,
  -- Snapshot of the total at order time, so a later price edit cannot rewrite
  -- what the guest agreed to pay.
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

-- Name and price are copied in, not joined: an order must still read correctly
-- after the dish is renamed, repriced or removed from the menu entirely.
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
