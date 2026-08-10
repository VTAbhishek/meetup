<?php
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/cascade.php';

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') json_error('Method not allowed', 405);

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

$id = (int) ($_GET['id'] ?? 0);
if ($id === (int) $user['id']) json_error("You can't delete your own account.", 400);

$stmt = db()->prepare('SELECT id, user_type FROM users WHERE id = ?');
$stmt->execute([$id]);
$target = $stmt->fetch();
if (!$target) json_error('User not found', 404);
if ($target['user_type'] === 'admin') json_error("Admin accounts can't be deleted here.", 400);

// Explicitly remove all dependent rows (the DB has no cascading FKs), then the
// account itself — companies they own, reviews/replies, tokens and OTP codes.
$pdo = db();
$pdo->beginTransaction();
try {
    delete_user_deep($pdo, $id);
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    json_error('Could not delete the account. Please try again.', 500);
}
json_out(['ok' => true]);
