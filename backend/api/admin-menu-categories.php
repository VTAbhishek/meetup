<?php
require_once __DIR__ . '/_bootstrap.php';

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = $pdo->query(
        "SELECT mc.id, mc.name, mc.created_at,
                (SELECT COUNT(*) FROM menu_items mi WHERE mi.category = mc.name) AS item_count
         FROM menu_categories mc
         ORDER BY mc.name"
    )->fetchAll();
    foreach ($rows as &$r) {
        $r['id'] = (int) $r['id'];
        $r['item_count'] = (int) $r['item_count'];
    }
    json_out(['categories' => $rows]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $in = json_in();
    $name = trim($in['name'] ?? '');
    if ($name === '')           json_error('Category name is required.', 422);
    if (mb_strlen($name) > 100) json_error('Category name is too long.', 422);

    $dup = $pdo->prepare('SELECT id FROM menu_categories WHERE name = ?');
    $dup->execute([$name]);
    if ($dup->fetch()) json_error('That category already exists.', 409);

    $pdo->prepare('INSERT INTO menu_categories (name) VALUES (?)')->execute([$name]);
    json_out(['id' => (int) $pdo->lastInsertId(), 'name' => $name], 201);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    $pdo->prepare('DELETE FROM menu_categories WHERE id = ?')->execute([$id]);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
