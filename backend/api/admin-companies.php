<?php
require_once __DIR__ . '/_bootstrap.php';

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

// All company profiles. Registered businesses (with an owner account) first,
// so newly registered companies appear at the top.
$rows = db()->query(
    "SELECT c.id, c.company_name, c.slug, c.website, c.category, c.description,
            c.phone, c.address, c.is_approved, c.status, c.created_at,
            c.district_id, c.city_id, d.name AS district_name, ci.name AS city_name,
            u.id AS user_id, u.full_name AS contact, u.username, u.email,
            u.created_at AS registered_at,
            (SELECT COUNT(*) FROM reviews r WHERE r.company_id = c.id) AS review_count,
            (SELECT COALESCE(ROUND(AVG(r.rating), 1), 0) FROM reviews r WHERE r.company_id = c.id) AS avg_rating
     FROM companies c
     LEFT JOIN users u     ON u.id  = c.user_id
     LEFT JOIN districts d ON d.id  = c.district_id
     LEFT JOIN cities ci   ON ci.id = c.city_id
     ORDER BY (u.id IS NOT NULL) DESC, c.created_at DESC"
)->fetchAll();

foreach ($rows as &$r) {
    $r['id']           = (int) $r['id'];
    $r['user_id']      = $r['user_id'] !== null ? (int) $r['user_id'] : null;
    $r['district_id']  = $r['district_id'] !== null ? (int) $r['district_id'] : null;
    $r['city_id']      = $r['city_id'] !== null ? (int) $r['city_id'] : null;
    $r['is_approved']  = (bool) $r['is_approved'];
    $r['review_count'] = (int) $r['review_count'];
    $r['avg_rating']   = (float) $r['avg_rating'];
    $r['claimed']      = $r['user_id'] !== null;
}

json_out([
    'companies' => $rows,
    'registered_count' => count(array_filter($rows, fn ($r) => $r['claimed'])),
]);
