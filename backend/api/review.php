<?php
require_once __DIR__ . '/_bootstrap.php';

$id = (int) ($_GET['id'] ?? 0);

// PUT -> edit own review
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $user = require_api_user();
    $stmt = db()->prepare('SELECT * FROM reviews WHERE id = ?');
    $stmt->execute([$id]);
    $review = $stmt->fetch();
    if (!$review) json_error('Review not found', 404);
    if ((int) $review['customer_id'] !== (int) $user['id']) json_error('Not your review', 403);

    $in     = json_in();
    $rating = (int) ($in['rating'] ?? $review['rating']);
    $title  = trim($in['title'] ?? (string) $review['title']);
    $body   = trim($in['body'] ?? (string) $review['body']);

    $errors = [];
    if ($rating < 1 || $rating > 5) $errors['rating'] = 'Rating must be 1 to 5.';
    if ($body === '')               $errors['body']   = 'Review cannot be empty.';
    if ($errors) json_out(['errors' => $errors], 422);

    db()->prepare('UPDATE reviews SET rating = ?, title = ?, body = ? WHERE id = ?')
        ->execute([$rating, $title ?: null, $body, $id]);
    json_out(['ok' => true]);
}

// DELETE -> remove own review
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $user = require_api_user();
    $stmt = db()->prepare('SELECT customer_id FROM reviews WHERE id = ?');
    $stmt->execute([$id]);
    $review = $stmt->fetch();
    if (!$review) json_error('Review not found', 404);
    if ((int) $review['customer_id'] !== (int) $user['id']) json_error('Not your review', 403);

    db()->prepare('DELETE FROM reviews WHERE id = ?')->execute([$id]);
    json_out(['ok' => true]);
}

// POST ?id=..&action=useful  -> increment the useful counter
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_GET['action'] ?? '') === 'useful') {
    db()->prepare('UPDATE reviews SET useful_count = useful_count + 1 WHERE id = ?')->execute([$id]);
    $n = db()->query('SELECT useful_count FROM reviews WHERE id = ' . $id)->fetchColumn();
    json_out(['useful_count' => (int) $n]);
}

json_error('Method not allowed', 405);
