<?php
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') json_error('Method not allowed', 405);

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

$id = (int) ($_GET['id'] ?? 0);
$stmt = db()->prepare('SELECT id FROM reviews WHERE id = ?');
$stmt->execute([$id]);
if (!$stmt->fetch()) json_error('Review not found', 404);

db()->prepare('DELETE FROM reviews WHERE id = ?')->execute([$id]);
json_out(['ok' => true]);
