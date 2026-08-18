<?php
require_once __DIR__ . '/_bootstrap.php';

$user = require_api_user();
if ($user['user_type'] !== 'customer') json_error('Forbidden', 403);

$pdo = db();
$page = max(1, (int) ($_GET['page'] ?? 1));
$status = trim($_GET['status'] ?? 'all');
$limit = 10;
$offset = ($page - 1) * $limit;

$countSql = "SELECT COUNT(*) FROM reservations WHERE customer_id = ?";
$listSql = "SELECT r.*, c.company_name, c.logo AS company_logo
            FROM reservations r
            JOIN companies c ON c.id = r.company_id
            WHERE r.customer_id = ?";
$params = [$user['id']];

if ($status === 'pending') {
    $countSql .= " AND status = 'pending'";
    $listSql .= " AND r.status = 'pending'";
} elseif ($status === 'confirmed') {
    $countSql .= " AND status = 'confirmed'";
    $listSql .= " AND r.status = 'confirmed'";
}

$stmt = $pdo->prepare($countSql);
$stmt->execute($params);
$total = (int) $stmt->fetchColumn();

$listSql .= " ORDER BY r.res_date DESC, r.time_from DESC LIMIT $limit OFFSET $offset";
$stmt = $pdo->prepare($listSql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

$out = array_map(function ($r) {
    $r['id'] = (int) $r['id'];
    $r['company_id'] = (int) $r['company_id'];
    $r['customer_id'] = (int) $r['customer_id'];
    $r['person_count'] = (int) $r['person_count'];
    $r['time_from'] = substr($r['time_from'], 0, 5);
    $r['time_to'] = substr($r['time_to'], 0, 5);
    $r['table_id'] = $r['table_id'] !== null ? (int) $r['table_id'] : null;
    $r['company_logo_url'] = asset_url($r['company_logo'] ?? null);
    unset($r['company_logo']);
    $r['items'] = [];
    $r['items_total'] = 0.0;
    return $r;
}, $rows);

if ($out) {
    $ids = array_column($out, 'id');
    $byId = [];
    foreach ($out as $i => $r) $byId[$r['id']] = $i;
    $ph = implode(',', array_fill(0, count($ids), '?'));
    $it = $pdo->prepare(
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

json_out([
    'reservations' => $out,
    'total'        => $total,
    'pages'        => ceil($total / $limit)
]);
