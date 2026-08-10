<?php
/**
 * Public: the district + city catalogue used by the registration form and the
 * site-wide location filters.
 *   GET -> { districts: [ { id, name, cities: [ { id, name } ] } ] }
 */
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$pdo = db();

$districts = $pdo->query('SELECT id, name FROM districts ORDER BY name')->fetchAll();
$cities    = $pdo->query('SELECT id, district_id, name FROM cities ORDER BY name')->fetchAll();

// Group cities under their district.
$byDistrict = [];
foreach ($cities as $c) {
    $did = (int) $c['district_id'];
    $byDistrict[$did][] = ['id' => (int) $c['id'], 'name' => $c['name']];
}

$out = [];
foreach ($districts as $d) {
    $id = (int) $d['id'];
    $out[] = [
        'id'     => $id,
        'name'   => $d['name'],
        'cities' => $byDistrict[$id] ?? [],
    ];
}

json_out(['districts' => $out]);
