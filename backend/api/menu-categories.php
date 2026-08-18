<?php
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$rows = db()->query("SELECT id, name FROM menu_categories ORDER BY name")->fetchAll();
json_out(['categories' => $rows]);
