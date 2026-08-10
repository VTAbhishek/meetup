<?php
/**
 * Reservations / bookings.
 *   POST            -> a logged-in CUSTOMER books a company (name, mobile, date,
 *                      time from/to, person count, description).
 *   GET ?mine=1     -> the logged-in COMPANY lists reservations it has received.
 */
require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];

// ---- Company lists its received reservations ----
if ($method === 'GET' && isset($_GET['mine'])) {
    $user = require_api_user();
    if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

    $stmt = db()->prepare('SELECT id FROM companies WHERE user_id = ?');
    $stmt->execute([$user['id']]);
    $cid = (int) ($stmt->fetchColumn() ?: 0);
    if (!$cid) json_error('Company not found', 404);

    $rows = db()->prepare(
        'SELECT r.*, u.full_name AS customer_name
         FROM reservations r JOIN users u ON u.id = r.customer_id
         WHERE r.company_id = ?
         ORDER BY (r.status = "pending") DESC, r.res_date DESC, r.time_from DESC'
    );
    $rows->execute([$cid]);
    $out = array_map(function ($r) {
        $r['id'] = (int) $r['id'];
        $r['company_id'] = (int) $r['company_id'];
        $r['customer_id'] = (int) $r['customer_id'];
        $r['person_count'] = (int) $r['person_count'];
        $r['time_from'] = substr($r['time_from'], 0, 5);
        $r['time_to'] = substr($r['time_to'], 0, 5);
        $r['items'] = [];
        $r['items_total'] = 0.0;
        return $r;
    }, $rows->fetchAll());

    // Attach the pre-ordered food items to each reservation (one round-trip).
    if ($out) {
        $ids = array_column($out, 'id');
        $byId = [];
        foreach ($out as $i => $r) $byId[$r['id']] = $i;
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $it = db()->prepare(
            "SELECT reservation_id, name, price, qty FROM reservation_items
             WHERE reservation_id IN ($ph) ORDER BY id"
        );
        $it->execute($ids);
        foreach ($it->fetchAll() as $row) {
            $idx = $byId[(int) $row['reservation_id']];
            $line = [
                'name'  => $row['name'],
                'price' => (float) $row['price'],
                'qty'   => (int) $row['qty'],
            ];
            $out[$idx]['items'][] = $line;
            $out[$idx]['items_total'] += $line['price'] * $line['qty'];
        }
    }
    json_out(['reservations' => $out]);
}

// ---- Customer creates a reservation ----
if ($method === 'POST') {
    $user = require_api_user();
    if ($user['user_type'] !== 'customer') json_error('Only customers can make a reservation. Please log in as a customer.', 403);

    $in        = json_in();
    $companyId = (int) ($in['company_id'] ?? 0);
    $name      = trim($in['name'] ?? '');
    $mobile    = trim($in['mobile'] ?? '');
    $date      = trim($in['res_date'] ?? '');
    $from      = trim($in['time_from'] ?? '');
    $to        = trim($in['time_to'] ?? '');
    $persons   = (int) ($in['person_count'] ?? 0);
    $desc      = trim($in['description'] ?? '');

    $errors = [];
    if ($name === '')                                   $errors['name'] = 'Please enter a name.';
    if (!preg_match('/^[0-9]{9,15}$/', preg_replace('/\s+/', '', $mobile)))
                                                        $errors['mobile'] = 'Enter a valid mobile number.';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date))     $errors['res_date'] = 'Please choose a date.';
    if (!preg_match('/^\d{2}:\d{2}$/', $from))           $errors['time_from'] = 'Choose a start time.';
    if (!preg_match('/^\d{2}:\d{2}$/', $to))             $errors['time_to'] = 'Choose an end time.';
    if (!$errors && $to <= $from)                       $errors['time_to'] = 'End time must be after the start time.';
    if ($persons < 1)                                   $errors['person_count'] = 'At least 1 person.';

    $c = db()->prepare('SELECT id, user_id FROM companies WHERE id = ?');
    $c->execute([$companyId]);
    $company = $c->fetch();
    if (!$company) $errors['company_id'] = 'Company not found.';

    if ($errors) json_out(['errors' => $errors], 422);

    // Optional pre-ordered food: [{ menu_item_id, qty }]. We look each item up
    // fresh from this company's available menu and snapshot its name + price, so
    // the order is immune to later menu edits / price changes.
    $cart = is_array($in['items'] ?? null) ? $in['items'] : [];
    $lines = [];
    foreach ($cart as $row) {
        $mid = (int) ($row['menu_item_id'] ?? 0);
        $qty = (int) ($row['qty'] ?? 0);
        if ($mid <= 0 || $qty <= 0) continue;
        if ($qty > 99) $qty = 99;
        $m = db()->prepare('SELECT name, price FROM menu_items WHERE id = ? AND company_id = ? AND is_available = 1');
        $m->execute([$mid, $companyId]);
        $item = $m->fetch();
        if (!$item) continue; // silently skip items that are gone / turned off
        $lines[] = ['menu_item_id' => $mid, 'name' => $item['name'], 'price' => (float) $item['price'], 'qty' => $qty];
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            'INSERT INTO reservations (company_id, customer_id, name, mobile, res_date, time_from, time_to, person_count, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$companyId, $user['id'], $name, $mobile, $date, $from, $to, $persons, $desc ?: null]);
        $rid = (int) $pdo->lastInsertId();

        if ($lines) {
            $ins = $pdo->prepare(
                'INSERT INTO reservation_items (reservation_id, menu_item_id, name, price, qty) VALUES (?, ?, ?, ?, ?)'
            );
            foreach ($lines as $l) {
                $ins->execute([$rid, $l['menu_item_id'], $l['name'], $l['price'], $l['qty']]);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_error('Could not save the reservation. Please try again.', 500);
    }

    json_out(['id' => $rid, 'status' => 'pending', 'items' => count($lines)], 201);
}

json_error('Method not allowed', 405);
