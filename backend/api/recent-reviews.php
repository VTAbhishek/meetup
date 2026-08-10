<?php
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$limit = min(24, max(1, (int) ($_GET['limit'] ?? 12)));

$rows = db()->query(
    "SELECT r.id, r.rating, r.title, r.body, r.created_at,
            u.full_name AS customer_name,
            c.company_name, c.slug, c.website
     FROM reviews r
     JOIN users u ON u.id = r.customer_id
     JOIN companies c ON c.id = r.company_id
     WHERE c.status = 'active' AND r.is_approved = 1
     ORDER BY r.created_at DESC
     LIMIT $limit"
)->fetchAll();

foreach ($rows as &$r) {
    $r['id']     = (int) $r['id'];
    $r['rating'] = (int) $r['rating'];
}
json_out(['reviews' => $rows]);
