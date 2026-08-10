<?php
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

$in     = json_in();
$id     = (int) ($in['id'] ?? 0);
$status = in_array($in['status'] ?? '', ['pending', 'active', 'inactive'], true) ? $in['status'] : null;
if (!$status) json_error('Invalid status.', 422);

$stmt = db()->prepare('SELECT user_id FROM companies WHERE id = ?');
$stmt->execute([$id]);
$company = $stmt->fetch();
if (!$company) json_error('Company not found', 404);

db()->prepare('UPDATE companies SET status = ? WHERE id = ?')->execute([$status, $id]);

// Deactivating/suspending a company revokes its owner's active sessions.
if ($status !== 'active' && $company['user_id']) {
    db()->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$company['user_id']]);
}
json_out(['ok' => true, 'status' => $status]);
