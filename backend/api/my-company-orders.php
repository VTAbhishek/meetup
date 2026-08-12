<?php
/**
 * Dine-in orders for the logged-in COMPANY — the kitchen / floor screen.
 *   GET               -> { orders: [{...,items:[...]}] }
 *   POST ?id= (JSON)  -> { status } move an order along: placed -> preparing
 *                        -> served, or cancelled
 *   DELETE ?id=       -> remove an order from the list once it's done with
 *
 * Live orders (placed / preparing) sort to the top: the screen exists to show
 * what still needs cooking, not what happened this morning.
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/orders.php';

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$pdo  = db();
$stmt = $pdo->prepare('SELECT id FROM companies WHERE user_id = ?');
$stmt->execute([$user['id']]);
$cid = (int) ($stmt->fetchColumn() ?: 0);
if (!$cid) json_error('Company not found', 404);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $rows = $pdo->prepare(
        "SELECT * FROM orders
          WHERE company_id = ?
          ORDER BY FIELD(status,'placed','preparing','served','cancelled'), created_at DESC"
    );
    $rows->execute([$cid]);
    $rows = $rows->fetchAll();

    $orders = [];
    foreach ($rows as $r) {
        $orders[] = order_row($r) + ['items' => []];
    }

    // Attach every line in one round-trip rather than a query per order.
    if ($orders) {
        $ids  = array_column($orders, 'id');
        $byId = [];
        foreach ($orders as $i => $o) $byId[$o['id']] = $i;

        $ph = implode(',', array_fill(0, count($ids), '?'));
        $it = $pdo->prepare("SELECT order_id, menu_item_id, name, price, qty FROM order_items WHERE order_id IN ($ph) ORDER BY id");
        $it->execute($ids);
        foreach ($it->fetchAll() as $l) {
            $orders[$byId[(int) $l['order_id']]]['items'][] = [
                'menu_item_id' => $l['menu_item_id'] !== null ? (int) $l['menu_item_id'] : null,
                'name'         => $l['name'],
                'price'        => (float) $l['price'],
                'qty'          => (int) $l['qty'],
            ];
        }
    }

    json_out(['orders' => $orders]);
}

// ---- Move an order along ----
if ($method === 'POST' && isset($_GET['id'])) {
    $id  = (int) $_GET['id'];
    $own = $pdo->prepare('SELECT id, ref, customer_id, table_label FROM orders WHERE id = ? AND company_id = ?');
    $own->execute([$id, $cid]);
    $order = $own->fetch();
    if (!$order) json_error('Order not found', 404);

    $in     = json_in();
    $status = $in['status'] ?? '';
    if (!in_array($status, ORDER_STATUSES, true)) json_error('Invalid status', 422);

    $pdo->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute([$status, $id]);

    // Guests have no account to notify; a logged-in customer gets told.
    if ($order['customer_id'] !== null && in_array($status, ['preparing', 'served', 'cancelled'], true)) {
        $said = ['preparing' => 'is being prepared', 'served' => 'has been served', 'cancelled' => 'was cancelled'][$status];
        $pdo->prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, "order", ?, ?, "/dashboard")')
            ->execute([(int) $order['customer_id'], 'Order ' . $order['ref'] . ' ' . $said, $order['table_label']]);
    }

    json_out(['ok' => true]);
}

if ($method === 'DELETE') {
    $id  = (int) ($_GET['id'] ?? 0);
    $own = $pdo->prepare('SELECT id FROM orders WHERE id = ? AND company_id = ?');
    $own->execute([$id, $cid]);
    if (!$own->fetchColumn()) json_error('Order not found', 404);

    // order_items cascades.
    $pdo->prepare('DELETE FROM orders WHERE id = ?')->execute([$id]);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
