<?php
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$in       = json_in();
$reviewId = (int) ($in['review_id'] ?? 0);
$body     = trim($in['body'] ?? '');
if ($body === '') json_error('Reply cannot be empty.', 422);

// The review must belong to a company owned by this user.
$stmt = db()->prepare(
    'SELECT c.id AS company_id
     FROM reviews r
     JOIN companies c ON c.id = r.company_id
     WHERE r.id = ? AND c.user_id = ?'
);
$stmt->execute([$reviewId, $user['id']]);
$row = $stmt->fetch();
if (!$row) json_error('Review not found for your company.', 404);

// One reply per review: replace any existing one.
db()->prepare('DELETE FROM review_replies WHERE review_id = ?')->execute([$reviewId]);
db()->prepare('INSERT INTO review_replies (review_id, company_id, body) VALUES (?, ?, ?)')
    ->execute([$reviewId, $row['company_id'], $body]);

json_out(['ok' => true]);
