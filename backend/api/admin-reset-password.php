<?php
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

$in  = json_in();
$uid = (int) ($in['user_id'] ?? 0);
$pw  = $in['password'] ?? '';

if (strlen($pw) < 6) json_error('Password must be at least 6 characters.', 422);

$stmt = db()->prepare('SELECT id FROM users WHERE id = ?');
$stmt->execute([$uid]);
if (!$stmt->fetch()) json_error('User not found', 404);

db()->prepare('UPDATE users SET password = ? WHERE id = ?')
    ->execute([password_hash($pw, PASSWORD_DEFAULT), $uid]);
// Force re-login with the new password.
db()->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$uid]);

json_out(['ok' => true]);
