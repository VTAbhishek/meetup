<?php
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

// Source the list from the managed `categories` table so admin-created
// categories appear too, with live company/review counts.
//
// TRIM on the company side: the match is exact, and a category saved with a
// stray leading or trailing space would silently count for nothing — the
// company would be missing from its own category page with no clue why.
// (Case differences already match under the table's collation.)
$rows = db()->query(
    "SELECT cat.name AS category,
            (SELECT COUNT(*) FROM companies c WHERE TRIM(c.category) = cat.name AND c.status = 'active') AS company_count,
            (SELECT COUNT(*) FROM reviews r JOIN companies c ON c.id = r.company_id WHERE TRIM(c.category) = cat.name AND c.status = 'active' AND r.is_approved = 1) AS review_count
     FROM categories cat
     ORDER BY cat.name"
)->fetchAll();

foreach ($rows as &$r) {
    $r['company_count'] = (int) $r['company_count'];
    $r['review_count']  = (int) $r['review_count'];
}
json_out(['categories' => $rows]);
