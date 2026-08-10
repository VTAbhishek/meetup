<?php
require_once __DIR__ . '/_bootstrap.php';

if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT'], true)) json_error('Method not allowed', 405);

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$stmt = db()->prepare('SELECT id FROM companies WHERE user_id = ?');
$stmt->execute([$user['id']]);
$company = $stmt->fetch();
if (!$company) json_error('No company profile found', 404);

$in          = json_in();
$name        = trim($in['company_name'] ?? '');
$website     = trim($in['website'] ?? '');
$category    = trim($in['category'] ?? '');
$phone       = trim($in['phone'] ?? '');
$address     = trim($in['address'] ?? '');
$description = trim($in['description'] ?? '');

if ($name === '') json_error('Company name is required.', 422);

db()->prepare(
    'UPDATE companies SET company_name = ?, website = ?, category = ?, phone = ?, address = ?, description = ?
     WHERE id = ?'
)->execute([
    $name,
    $website ?: null,
    $category ?: null,
    $phone ?: null,
    $address ?: null,
    $description ?: null,
    $company['id'],
]);

json_out(['ok' => true]);
