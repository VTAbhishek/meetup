<?php
/**
 * Admin: list districts (with how many cities each holds).
 * GET -> { districts: [{ id, name, city_count }] }
 */
require_once __DIR__ . '/_bootstrap.php';

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = db()->query(
        "SELECT d.id, d.name,
                (SELECT COUNT(*) FROM cities c WHERE c.district_id = d.id) AS city_count
         FROM districts d
         ORDER BY d.name"
    )->fetchAll();
    foreach ($rows as &$r) {
        $r['id'] = (int) $r['id'];
        $r['city_count'] = (int) $r['city_count'];
    }
    json_out(['districts' => $rows]);
}

json_error('Method not allowed', 405);
