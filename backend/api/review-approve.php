<?php
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$in       = json_in();
$reviewId = (int) ($in['review_id'] ?? 0);
$approved = !empty($in['approved']) ? 1 : 0;

// The review must belong to a company owned by this user.
$stmt = db()->prepare(
    'SELECT r.id
     FROM reviews r
     JOIN companies c ON c.id = r.company_id
     WHERE r.id = ? AND c.user_id = ?'
);
$stmt->execute([$reviewId, $user['id']]);
if (!$stmt->fetch()) json_error('Review not found for your company.', 404);

db()->prepare('UPDATE reviews SET is_approved = ? WHERE id = ?')->execute([$approved, $reviewId]);
json_out(['ok' => true, 'is_approved' => $approved]);
