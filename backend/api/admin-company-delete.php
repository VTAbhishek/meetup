<?php
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/cascade.php';

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') json_error('Method not allowed', 405);

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

$id = (int) ($_GET['id'] ?? 0);
$stmt = db()->prepare('SELECT id, user_id FROM companies WHERE id = ?');
$stmt->execute([$id]);
$company = $stmt->fetch();
if (!$company) json_error('Company not found', 404);

$pdo = db();
$pdo->beginTransaction();
try {
    if ($company['user_id']) {
        // Registered business: remove the owner account and everything under it
        // (this company, its reviews/replies/payments, tokens, OTP codes).
        delete_user_deep($pdo, (int) $company['user_id']);
    } else {
        // Unclaimed profile: just the company and its content.
        delete_company_deep($pdo, $id);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    json_error('Could not delete the company. Please try again.', 500);
}
json_out(['ok' => true]);
