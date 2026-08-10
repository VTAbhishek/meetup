<?php
/**
 * Profile picture for the logged-in user (any account type).
 *   POST (multipart field "avatar") -> upload/replace
 *   DELETE                          -> remove
 * Returns { avatar_url }.
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/upload.php';

$user = require_api_user();
$uid  = (int) $user['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $rel = save_uploaded_image('avatar', 'avatars', 5 * 1024 * 1024, 'user_' . $uid); // 5 MB
    delete_asset_file($user['avatar'] ?? null);
    db()->prepare('UPDATE users SET avatar = ? WHERE id = ?')->execute([$rel, $uid]);
    json_out(['avatar_url' => asset_url($rel)]);
}

if ($method === 'DELETE') {
    delete_asset_file($user['avatar'] ?? null);
    db()->prepare('UPDATE users SET avatar = NULL WHERE id = ?')->execute([$uid]);
    json_out(['ok' => true, 'avatar_url' => null]);
}

json_error('Method not allowed', 405);
