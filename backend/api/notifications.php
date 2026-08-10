<?php
/**
 * In-app notifications for the logged-in user.
 *   GET          -> { notifications: [...], count }
 *   DELETE ?id=  -> dismiss one (removed when the user opens it)
 *   DELETE ?all=1 -> dismiss all
 */
require_once __DIR__ . '/_bootstrap.php';

$user = require_api_user();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = db()->prepare('SELECT id, type, title, body, link, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC');
    $stmt->execute([$user['id']]);
    $rows = array_map(function ($r) {
        $r['id'] = (int) $r['id'];
        return $r;
    }, $stmt->fetchAll());
    json_out(['notifications' => $rows, 'count' => count($rows)]);
}

if ($method === 'DELETE') {
    if (isset($_GET['all'])) {
        db()->prepare('DELETE FROM notifications WHERE user_id = ?')->execute([$user['id']]);
        json_out(['ok' => true]);
    }
    $id = (int) ($_GET['id'] ?? 0);
    db()->prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?')->execute([$id, $user['id']]);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
