<?php
/**
 * Everything the QR ordering page needs, in one request.
 *   GET ?token=<table qr_token>
 *   -> { company: {...}, table: {...}, categories: [...], items: [...] }
 *
 * A guest scans the card on their table and lands here: the company and the
 * table are identified by the token alone, so nothing has to be typed or
 * chosen. Only dishes the company currently has switched on are returned —
 * an item turned off is not something a guest should be able to order.
 */
require_once __DIR__ . '/_bootstrap.php';

// The page re-fetches to catch a dish being switched off mid-visit; a cached
// response would keep offering it.
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$token = trim($_GET['token'] ?? '');
if (!preg_match('/^[a-f0-9]{32}$/i', $token)) json_error('That QR code is not valid.', 404);

$pdo = db();
$stmt = $pdo->prepare(
    'SELECT t.id AS table_id, t.category, t.table_no, t.seats, t.is_active,
            c.id AS company_id, c.slug, c.company_name, c.logo, c.address, c.phone
       FROM company_tables t
       JOIN companies c ON c.id = t.company_id
      WHERE t.qr_token = ? AND c.status = "active"'
);
$stmt->execute([$token]);
$row = $stmt->fetch();
if (!$row) json_error('That QR code is not valid.', 404);

// A table switched off is not taking orders — say so plainly rather than
// showing a menu that cannot be ordered from.
if ((int) $row['is_active'] !== 1) {
    json_out([
        'closed'  => true,
        'message' => 'This table is not taking orders right now. Please ask a member of staff.',
        'company' => ['company_name' => $row['company_name']],
    ], 200);
}

$menu = $pdo->prepare(
    'SELECT id, category, name, price, image
       FROM menu_items
      WHERE company_id = ? AND is_available = 1
      ORDER BY category, sort_order, id'
);
$menu->execute([(int) $row['company_id']]);

$items = [];
$categories = [];
foreach ($menu->fetchAll() as $m) {
    if (!in_array($m['category'], $categories, true)) $categories[] = $m['category'];
    $items[] = [
        'id'        => (int) $m['id'],
        'category'  => $m['category'],
        'name'      => $m['name'],
        'price'     => (float) $m['price'],
        'image_url' => $m['image'] ? asset_url($m['image']) : null,
    ];
}

json_out([
    'closed'  => false,
    'company' => [
        'slug'         => $row['slug'],
        'company_name' => $row['company_name'],
        'logo_url'     => asset_url($row['logo'] ?? null),
        'address'      => $row['address'],
        'phone'        => $row['phone'],
    ],
    'table' => [
        'id'       => (int) $row['table_id'],
        'category' => $row['category'],
        'table_no' => $row['table_no'],
        'seats'    => (int) $row['seats'],
    ],
    'categories' => $categories,
    'items'      => $items,
]);
