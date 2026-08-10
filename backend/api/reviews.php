<?php
require_once __DIR__ . '/_bootstrap.php';

// GET ?mine=1  -> the logged-in customer's reviews (for the dashboard)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $user = require_api_user();
    $stmt = db()->prepare(
        "SELECT r.id, r.rating, r.title, r.body, r.experience_date, r.created_at,
                c.id AS company_id, c.company_name, c.slug, c.website
         FROM reviews r
         JOIN companies c ON c.id = r.company_id
         WHERE r.customer_id = ?
         ORDER BY r.created_at DESC"
    );
    $stmt->execute([$user['id']]);
    $rows = array_map(function ($r) {
        $r['id'] = (int) $r['id'];
        $r['rating'] = (int) $r['rating'];
        $r['company_id'] = (int) $r['company_id'];
        return $r;
    }, $stmt->fetchAll());
    json_out(['reviews' => $rows]);
}

// POST -> create a review
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = require_api_user();
    $in        = json_in();
    $companyId = (int) ($in['company_id'] ?? 0);
    $rating    = (int) ($in['rating'] ?? 0);
    $title     = trim($in['title'] ?? '');
    $body      = trim($in['body'] ?? '');
    $expDate   = $in['experience_date'] ?? null;

    $errors = [];
    if ($rating < 1 || $rating > 5) $errors['rating'] = 'Please choose a rating from 1 to 5.';
    if ($body === '')               $errors['body']   = 'Please describe your experience.';

    $c = db()->prepare('SELECT id, user_id FROM companies WHERE id = ?');
    $c->execute([$companyId]);
    $company = $c->fetch();
    if (!$company) $errors['company_id'] = 'Company not found.';

    if ($errors) json_out(['errors' => $errors], 422);

    // Reviews for a registered (claimed) company are held until the company
    // grants access. Reviews on unclaimed profiles are shown immediately.
    $approved = $company['user_id'] ? 0 : 1;

    $stmt = db()->prepare(
        'INSERT INTO reviews (customer_id, company_id, rating, title, body, experience_date, is_approved)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$user['id'], $companyId, $rating, $title ?: null, $body, $expDate ?: null, $approved]);
    json_out(['id' => (int) db()->lastInsertId(), 'pending' => $approved === 0], 201);
}

json_error('Method not allowed', 405);
