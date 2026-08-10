<?php
require_once __DIR__ . '/_bootstrap.php';

if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT'], true)) json_error('Method not allowed', 405);

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

$in       = json_in();
$id       = (int) ($in['id'] ?? $_GET['id'] ?? 0);
$category = trim($in['category'] ?? '');

$stmt = db()->prepare('SELECT id FROM companies WHERE id = ?');
$stmt->execute([$id]);
if (!$stmt->fetch()) json_error('Company not found', 404);

db()->prepare('UPDATE companies SET category = ? WHERE id = ?')->execute([$category ?: null, $id]);
json_out(['ok' => true, 'category' => $category ?: null]);
