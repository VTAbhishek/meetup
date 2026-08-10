<?php
require_once __DIR__ . '/_bootstrap.php';

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

$id = (int) ($_GET['id'] ?? 0);
$stmt = db()->prepare(
    'SELECT c.*, u.full_name AS contact, u.username, u.email, u.created_at AS registered_at,
            d.name AS district_name, ci.name AS city_name
     FROM companies c
     LEFT JOIN users u     ON u.id  = c.user_id
     LEFT JOIN districts d ON d.id  = c.district_id
     LEFT JOIN cities ci   ON ci.id = c.city_id
     WHERE c.id = ?'
);
$stmt->execute([$id]);
$c = $stmt->fetch();
if (!$c) json_error('Company not found', 404);

$agg = db()->prepare('SELECT COALESCE(ROUND(AVG(rating),1),0) avg_rating, COUNT(*) review_count FROM reviews WHERE company_id = ?');
$agg->execute([$id]);
$a = $agg->fetch();

$rev = db()->prepare(
    'SELECT r.id, r.rating, r.title, r.body, r.created_at, u.full_name AS customer_name
     FROM reviews r JOIN users u ON u.id = r.customer_id
     WHERE r.company_id = ? ORDER BY r.created_at DESC'
);
$rev->execute([$id]);

json_out([
    'company' => [
        'id'           => (int) $c['id'],
        'user_id'      => $c['user_id'] !== null ? (int) $c['user_id'] : null,
        'company_name' => $c['company_name'],
        'slug'         => $c['slug'],
        'website'      => $c['website'],
        'category'     => $c['category'],
        'description'  => $c['description'],
        'phone'        => $c['phone'],
        'address'      => $c['address'],
        'district_name'=> $c['district_name'],
        'city_name'    => $c['city_name'],
        'status'       => $c['status'],
        'claimed'      => $c['user_id'] !== null,
        'contact'      => $c['contact'],
        'username'     => $c['username'],
        'email'        => $c['email'],
        'registered_at' => $c['registered_at'],
        'created_at'   => $c['created_at'],
        'avg_rating'   => (float) $a['avg_rating'],
        'review_count' => (int) $a['review_count'],
    ],
    'reviews' => array_map(fn ($r) => [
        'id'            => (int) $r['id'],
        'rating'        => (int) $r['rating'],
        'title'         => $r['title'],
        'body'          => $r['body'],
        'created_at'    => $r['created_at'],
        'customer_name' => $r['customer_name'],
    ], $rev->fetchAll()),
]);
