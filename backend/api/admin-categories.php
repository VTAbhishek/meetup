<?php
require_once __DIR__ . '/_bootstrap.php';

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

// GET -> list categories with how many companies use each
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = db()->query(
        "SELECT c.id, c.name, c.created_at,
                (SELECT COUNT(*) FROM companies co WHERE co.category = c.name) AS company_count
         FROM categories c
         ORDER BY c.name"
    )->fetchAll();
    foreach ($rows as &$r) {
        $r['id'] = (int) $r['id'];
        $r['company_count'] = (int) $r['company_count'];
    }
    json_out(['categories' => $rows]);
}

// POST -> create a new category
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $in   = json_in();
    $name = trim($in['name'] ?? '');
    if ($name === '')            json_error('Category name is required.', 422);
    if (mb_strlen($name) > 100)  json_error('Category name is too long.', 422);

    $dup = db()->prepare('SELECT id FROM categories WHERE name = ?');
    $dup->execute([$name]);
    if ($dup->fetch()) json_error('That category already exists.', 409);

    db()->prepare('INSERT INTO categories (name) VALUES (?)')->execute([$name]);
    json_out(['id' => (int) db()->lastInsertId(), 'name' => $name], 201);
}

// DELETE ?id= -> remove a category (companies keep their label)
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    db()->prepare('DELETE FROM categories WHERE id = ?')->execute([$id]);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
