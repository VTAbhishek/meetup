<?php
/**
 * Public table picker for the customer reservation form.
 *   GET ?slug=<company-slug>            (or ?company_id=<id>)
 *       &date=YYYY-MM-DD&from=HH:MM&to=HH:MM   (optional — enables booked flags)
 *   -> { categories: ["VIP","Family",...],
 *        tables: [{id,category,table_no,seats,note,image_url,booked}] }
 *
 * Only active tables are returned. When a valid date + time range is supplied,
 * `booked` marks the tables already taken for that slot so the customer sees
 * them greyed out instead of picking one and being rejected on submit.
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/tables.php';

$slug = trim($_GET['slug'] ?? '');
$cid  = (int) ($_GET['company_id'] ?? 0);

$pdo = db();
if ($cid <= 0) {
    if ($slug === '') json_error('Missing company.', 422);
    $c = $pdo->prepare('SELECT id FROM companies WHERE slug = ?');
    $c->execute([$slug]);
    $cid = (int) ($c->fetchColumn() ?: 0);
}
if ($cid <= 0) json_error('Company not found', 404);

$stmt = $pdo->prepare(
    'SELECT id, category, table_no, seats, note, image, is_active, sort_order
     FROM company_tables
     WHERE company_id = ? AND is_active = 1
     ORDER BY category, sort_order, id'
);
$stmt->execute([$cid]);
$rows = $stmt->fetchAll();

// Booked flags are only meaningful for a fully specified, sane slot.
$date = trim($_GET['date'] ?? '');
$from = trim($_GET['from'] ?? '');
$to   = trim($_GET['to'] ?? '');
$booked = [];
if (
    preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)
    && preg_match('/^\d{2}:\d{2}$/', $from)
    && preg_match('/^\d{2}:\d{2}$/', $to)
    && $to > $from
) {
    $booked = booked_table_ids($pdo, $cid, $date, $from, $to);
}

$tables     = [];
$categories = [];
foreach ($rows as $r) {
    if (!in_array($r['category'], $categories, true)) $categories[] = $r['category'];
    $t = company_table_row($r);
    unset($t['is_active'], $t['sort_order']); // internal-only fields
    $t['booked'] = in_array((int) $r['id'], $booked, true);
    $tables[] = $t;
}

json_out(['categories' => $categories, 'tables' => $tables]);
