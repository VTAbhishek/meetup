<?php
/**
 * Daily POS sales summary for the logged-in COMPANY.
 *   GET ?date=YYYY-MM-DD  (defaults to today, in app timezone)
 *     -> { date, summary:{invoice_count,subtotal,discount,total},
 *          invoices:[...], top_products:[{product_name,qty,revenue}] }
 *
 * Scoped to the caller's company.
 */
require_once __DIR__ . '/_bootstrap.php';

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$pdo = db();
$stmt = $pdo->prepare('SELECT id FROM companies WHERE user_id = ?');
$stmt->execute([$user['id']]);
$cid = (int) ($stmt->fetchColumn() ?: 0);
if (!$cid) json_error('Company not found', 404);

$date = $_GET['date'] ?? date('Y-m-d');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) $date = date('Y-m-d');

// Half-open [start, next-day) range instead of DATE(created_at) = ?: wrapping
// the column in DATE() would stop MySQL using the (company_id, created_at)
// index for the date, so a busy company's reports would slow down over time.
$start = $date . ' 00:00:00';
$end   = date('Y-m-d 00:00:00', strtotime($date . ' +1 day'));

$sum = $pdo->prepare(
    "SELECT COUNT(*) AS invoice_count,
            COALESCE(SUM(subtotal),0) AS subtotal,
            COALESCE(SUM(discount),0) AS discount,
            COALESCE(SUM(total),0)    AS total
     FROM pos_invoices WHERE company_id = ? AND created_at >= ? AND created_at < ?"
);
$sum->execute([$cid, $start, $end]);
$s = $sum->fetch();
$summary = [
    'invoice_count' => (int) $s['invoice_count'],
    'subtotal'      => (float) $s['subtotal'],
    'discount'      => (float) $s['discount'],
    'total'         => (float) $s['total'],
];

$list = $pdo->prepare(
    'SELECT id, invoice_no, customer_name, total, created_at
     FROM pos_invoices WHERE company_id = ? AND created_at >= ? AND created_at < ? ORDER BY id DESC'
);
$list->execute([$cid, $start, $end]);
$invoices = array_map(fn ($r) => [
    'id'            => (int) $r['id'],
    'invoice_no'    => $r['invoice_no'],
    'customer_name' => $r['customer_name'],
    'total'         => (float) $r['total'],
    'created_at'    => $r['created_at'],
], $list->fetchAll());

$top = $pdo->prepare(
    'SELECT ii.product_name, SUM(ii.qty) AS qty, SUM(ii.line_total) AS revenue
     FROM pos_invoice_items ii
     JOIN pos_invoices i ON i.id = ii.invoice_id
     WHERE i.company_id = ? AND i.created_at >= ? AND i.created_at < ?
     GROUP BY ii.product_name ORDER BY qty DESC LIMIT 10'
);
$top->execute([$cid, $start, $end]);
$topProducts = array_map(fn ($r) => [
    'product_name' => $r['product_name'],
    'qty'          => (int) $r['qty'],
    'revenue'      => (float) $r['revenue'],
], $top->fetchAll());

json_out([
    'date'         => $date,
    'summary'      => $summary,
    'invoices'     => $invoices,
    'top_products' => $topProducts,
]);
