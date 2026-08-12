<?php
/**
 * The guest's own view of the order they just placed.
 *   GET ?t=<track_token>
 *   -> { ref, status, total, table_label, items: [...], created_at }
 *
 * Keyed on the unguessable track token rather than the short ref, so one
 * table's phone cannot read another table's order by trying codes.
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/orders.php';

// Polled while the guest waits, so the status must never come from a cache.
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$token = trim($_GET['t'] ?? '');
if (!preg_match('/^[a-f0-9]{32}$/i', $token)) json_error('Order not found', 404);

$stmt = db()->prepare(
    'SELECT o.*, c.company_name
       FROM orders o
       JOIN companies c ON c.id = o.company_id
      WHERE o.track_token = ?'
);
$stmt->execute([$token]);
$row = $stmt->fetch();
if (!$row) json_error('Order not found', 404);

json_out(order_row($row) + [
    'company_name' => $row['company_name'],
    'items'        => order_items(db(), (int) $row['id']),
]);
