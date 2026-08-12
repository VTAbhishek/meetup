<?php
/**
 * Resolve the token printed on a table's QR card.
 *   GET ?token=<qr_token>
 *   -> { company: {slug, company_name}, table: {id, category, table_no, seats, is_active} }
 *
 * A customer scans the code at the table, lands on the reservation page and
 * finds that table already picked. Public by design — the token is what makes
 * it safe, so it is matched exactly and nothing else is exposed.
 */
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$token = trim($_GET['token'] ?? '');
// Tokens are 32 hex characters. Rejecting anything else keeps junk out of the
// query and makes a scrape-by-guessing attempt pointless.
if (!preg_match('/^[a-f0-9]{32}$/i', $token)) json_error('That QR code is not valid.', 404);

$stmt = db()->prepare(
    'SELECT t.id, t.category, t.table_no, t.seats, t.is_active,
            c.slug, c.company_name
       FROM company_tables t
       JOIN companies c ON c.id = t.company_id
      WHERE t.qr_token = ? AND c.status = "active"'
);
$stmt->execute([$token]);
$row = $stmt->fetch();

if (!$row) json_error('That QR code is not valid.', 404);

json_out([
    'company' => [
        'slug'         => $row['slug'],
        'company_name' => $row['company_name'],
    ],
    'table' => [
        'id'        => (int) $row['id'],
        'category'  => $row['category'],
        'table_no'  => $row['table_no'],
        'seats'     => (int) $row['seats'],
        'is_active' => (int) $row['is_active'] === 1,
    ],
]);
