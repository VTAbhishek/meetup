<?php
/**
 * Public menu for a company, used by the customer pre-order / reservation flow.
 *   GET ?slug=<company-slug>   (or ?company_id=<id>)
 *   -> { categories: ["Kottu","Rice",...],
 *        items: [{id,category,name,price,image_url}] }   // available items only
 */
require_once __DIR__ . '/_bootstrap.php';

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
    'SELECT id, category, name, price, image
     FROM menu_items
     WHERE company_id = ? AND is_available = 1
     ORDER BY category, sort_order, id'
);
$stmt->execute([$cid]);

$items = [];
$categories = [];
foreach ($stmt->fetchAll() as $r) {
    if (!in_array($r['category'], $categories, true)) $categories[] = $r['category'];
    $items[] = [
        'id'        => (int) $r['id'],
        'category'  => $r['category'],
        'name'      => $r['name'],
        'price'     => (float) $r['price'],
        'image_url' => $r['image'] ? asset_url($r['image']) : null,
    ];
}

json_out(['categories' => $categories, 'items' => $items]);
