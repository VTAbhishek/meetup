<?php
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

$in     = json_in();
$userId = (int) ($in['user_id'] ?? 0);
$status = in_array($in['status'] ?? '', ['pending', 'active', 'inactive'], true) ? $in['status'] : null;
if (!$status) json_error('Invalid status.', 422);

if ($userId === (int) $user['id']) json_error("You can't change your own status.", 400);

$target = db()->prepare("SELECT id, user_type FROM users WHERE id = ?");
$target->execute([$userId]);
$t = $target->fetch();
if (!$t) json_error('User not found', 404);
if ($t['user_type'] === 'admin') json_error("Admin accounts can't be changed here.", 400);

db()->prepare('UPDATE users SET status = ? WHERE id = ?')->execute([$status, $userId]);
// Anything other than active revokes their active sessions.
if ($status !== 'active') {
    db()->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$userId]);
}
json_out(['ok' => true, 'status' => $status]);
