<?php
/**
 * Admin: manage cities that belong to a district.
 *   GET    ?district_id=  -> list cities for that district
 *   POST   { district_id, name } -> add a city to a district
 *   DELETE ?id=           -> remove a city
 */
require_once __DIR__ . '/_bootstrap.php';

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

$method = $_SERVER['REQUEST_METHOD'];

// ---- list cities for a district ----
if ($method === 'GET') {
    $districtId = (int) ($_GET['district_id'] ?? 0);
    if ($districtId <= 0) json_error('A district is required.', 422);

    $stmt = db()->prepare(
        'SELECT id, district_id, name, created_at
           FROM cities WHERE district_id = ? ORDER BY name'
    );
    $stmt->execute([$districtId]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['id'] = (int) $r['id'];
        $r['district_id'] = (int) $r['district_id'];
    }
    json_out(['cities' => $rows]);
}

// ---- add a city under a district ----
if ($method === 'POST') {
    $in         = json_in();
    $districtId = (int) ($in['district_id'] ?? 0);
    $name       = trim($in['name'] ?? '');

    if ($districtId <= 0)       json_error('Choose a district first.', 422);
    if ($name === '')           json_error('City name is required.', 422);
    if (mb_strlen($name) > 120) json_error('City name is too long.', 422);

    // District must exist.
    $chk = db()->prepare('SELECT id FROM districts WHERE id = ?');
    $chk->execute([$districtId]);
    if (!$chk->fetch()) json_error('That district does not exist.', 404);

    // No duplicate city within the same district.
    $dup = db()->prepare('SELECT id FROM cities WHERE district_id = ? AND name = ?');
    $dup->execute([$districtId, $name]);
    if ($dup->fetch()) json_error('That city already exists in this district.', 409);

    db()->prepare('INSERT INTO cities (district_id, name) VALUES (?, ?)')
        ->execute([$districtId, $name]);

    json_out(['id' => (int) db()->lastInsertId(), 'district_id' => $districtId, 'name' => $name], 201);
}

// ---- remove a city ----
if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) json_error('Invalid city.', 422);
    db()->prepare('DELETE FROM cities WHERE id = ?')->execute([$id]);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
