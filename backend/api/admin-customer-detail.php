<?php
require_once __DIR__ . '/_bootstrap.php';

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

$id = (int) ($_GET['id'] ?? 0);
$stmt = db()->prepare("SELECT id, full_name, username, email, status, created_at FROM users WHERE id = ? AND user_type = 'customer'");
$stmt->execute([$id]);
$c = $stmt->fetch();
if (!$c) json_error('Customer not found', 404);

$rev = db()->prepare(
    'SELECT r.id, r.rating, r.title, r.body, r.created_at, c.company_name, c.slug
     FROM reviews r JOIN companies c ON c.id = r.company_id
     WHERE r.customer_id = ? ORDER BY r.created_at DESC'
);
$rev->execute([$id]);

json_out([
    'customer' => [
        'id'         => (int) $c['id'],
        'full_name'  => $c['full_name'],
        'username'   => $c['username'],
        'email'      => $c['email'],
        'status'     => $c['status'],
        'created_at' => $c['created_at'],
    ],
    'reviews' => array_map(fn ($r) => [
        'id'           => (int) $r['id'],
        'rating'       => (int) $r['rating'],
        'title'        => $r['title'],
        'body'         => $r['body'],
        'created_at'   => $r['created_at'],
        'company_name' => $r['company_name'],
        'slug'         => $r['slug'],
    ], $rev->fetchAll()),
]);
