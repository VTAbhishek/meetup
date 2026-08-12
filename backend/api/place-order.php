<?php
/**
 * A guest sends their order from the table's QR page.
 *   POST { token, items: [{menu_item_id, qty}], name?, mobile?, people?, note? }
 *   -> { ref, track_token, status, total, items: [...] }
 *
 * No account is required — the guest is sitting at the table, and asking them
 * to register first is how an order gets abandoned. The table's QR token is
 * what identifies them. If a customer happens to be logged in, the order is
 * linked to them as well so it shows up in their history.
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/orders.php';
require_once __DIR__ . '/../helpers/tables.php';

const MAX_ORDER_LINES = 40;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$in    = json_in();
$token = trim($in['token'] ?? '');
if (!preg_match('/^[a-f0-9]{32}$/i', $token)) json_error('That QR code is not valid.', 404);

$pdo  = db();
$stmt = $pdo->prepare(
    'SELECT t.id AS table_id, t.category, t.table_no, t.seats, t.is_active,
            c.id AS company_id, c.user_id, c.company_name
       FROM company_tables t
       JOIN companies c ON c.id = t.company_id
      WHERE t.qr_token = ? AND c.status = "active"'
);
$stmt->execute([$token]);
$ctx = $stmt->fetch();
if (!$ctx) json_error('That QR code is not valid.', 404);
if ((int) $ctx['is_active'] !== 1) json_error('This table is not taking orders right now.', 409);

$companyId = (int) $ctx['company_id'];

// ---- What was ordered ----
$cart = is_array($in['items'] ?? null) ? $in['items'] : [];
if (count($cart) > MAX_ORDER_LINES) json_error('That is too many different dishes for one order.', 422);

[$lines, $total] = price_order_lines($pdo, $companyId, $cart);
// Everything asked for is gone or switched off — sending an empty order to the
// kitchen helps nobody, so say what happened instead.
if (!$lines) json_error('Your cart is empty, or those dishes are no longer available.', 422);

// ---- Who is at the table ----
$name   = trim($in['name'] ?? '');
$mobile = trim($in['mobile'] ?? '');
$note   = trim($in['note'] ?? '');
$people = (int) ($in['people'] ?? 1);

if (mb_strlen($name) > 150)   json_error('That name is too long.', 422);
if (mb_strlen($note) > 300)   json_error('The note is too long (max 300 characters).', 422);
if ($mobile !== '' && !preg_match('/^[0-9]{9,15}$/', preg_replace('/\s+/', '', $mobile))) {
    json_error('Enter a valid mobile number, or leave it blank.', 422);
}
if ($people < 1)  $people = 1;
if ($people > 99) $people = 99;

// A logged-in customer gets the order linked to their account; a guest does not
// need one. Either way the order is accepted.
$user       = api_user();
$customerId = ($user && $user['user_type'] === 'customer') ? (int) $user['id'] : null;
if ($name === '' && $user) $name = $user['full_name'];

$ref        = new_order_ref($pdo);
$trackToken = bin2hex(random_bytes(16));
$tableLabel = company_table_label(['category' => $ctx['category'], 'table_no' => $ctx['table_no']]);

$pdo->beginTransaction();
try {
    $pdo->prepare(
        'INSERT INTO orders (ref, track_token, company_id, table_id, table_label, customer_id, name, mobile, people, note, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $ref, $trackToken, $companyId, (int) $ctx['table_id'], $tableLabel, $customerId,
        $name !== '' ? $name : null, $mobile !== '' ? $mobile : null, $people, $note !== '' ? $note : null, $total,
    ]);
    $orderId = (int) $pdo->lastInsertId();

    $ins = $pdo->prepare('INSERT INTO order_items (order_id, menu_item_id, name, price, qty) VALUES (?, ?, ?, ?, ?)');
    foreach ($lines as $l) $ins->execute([$orderId, $l['menu_item_id'], $l['name'], $l['price'], $l['qty']]);

    // Tell the company straight away — an order nobody notices is a cold meal.
    $pdo->prepare(
        'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, "order", ?, ?, "/business")'
    )->execute([
        (int) $ctx['user_id'],
        'New order · ' . $tableLabel,
        'Order ' . $ref . ' — ' . count($lines) . ' ' . (count($lines) === 1 ? 'dish' : 'dishes') . ', Rs ' . number_format($total, 0),
    ]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    json_error('Could not send your order. Please try again.', 500);
}

json_out([
    'ref'         => $ref,
    'track_token' => $trackToken,
    'status'      => 'placed',
    'total'       => $total,
    'table_label' => $tableLabel,
    'items'       => $lines,
], 201);
