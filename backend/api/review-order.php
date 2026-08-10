<?php
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$in    = json_in();
$order = $in['order'] ?? [];
if (!is_array($order)) json_error('Invalid order.', 422);

$stmt = db()->prepare('SELECT id FROM companies WHERE user_id = ?');
$stmt->execute([$user['id']]);
$company = $stmt->fetch();
if (!$company) json_error('No company profile found', 404);
$cid = (int) $company['id'];

// Assign incremental sort_order to the company's reviews in the given order.
$upd = db()->prepare('UPDATE reviews SET sort_order = ? WHERE id = ? AND company_id = ?');
$i = 1;
foreach ($order as $rid) {
    $upd->execute([$i, (int) $rid, $cid]);
    $i++;
}
json_out(['ok' => true]);
