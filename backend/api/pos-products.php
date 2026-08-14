<?php
/**
 * POS products for the logged-in COMPANY (counter catalogue with SKU + stock).
 *   GET            -> { products: [{id,name,sku,price,stock,is_active}] }
 *   POST           -> add one: { name, sku?, price?, stock? }
 *   PUT  ?id=      -> update: any of { name, sku, price, stock, is_active }
 *   DELETE ?id=    -> remove the product
 *
 * Everything is scoped to the caller's company, so each company only ever
 * sees and touches its own catalogue.
 */
require_once __DIR__ . '/_bootstrap.php';

const MAX_POS_PRODUCTS = 2000;

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$pdo = db();
$stmt = $pdo->prepare('SELECT id FROM companies WHERE user_id = ?');
$stmt->execute([$user['id']]);
$cid = (int) ($stmt->fetchColumn() ?: 0);
if (!$cid) json_error('Company not found', 404);

function pos_products_list(PDO $pdo, int $cid): array
{
    $stmt = $pdo->prepare(
        'SELECT id, name, sku, price, stock, is_active
         FROM pos_products WHERE company_id = ? ORDER BY name'
    );
    $stmt->execute([$cid]);
    return array_map(fn ($r) => [
        'id'        => (int) $r['id'],
        'name'      => $r['name'],
        'sku'       => $r['sku'],
        'price'     => (float) $r['price'],
        'stock'     => (int) $r['stock'],
        'is_active' => (int) $r['is_active'] === 1,
    ], $stmt->fetchAll());
}

/** Validate + normalise a SKU for this company; returns null when blank. */
function pos_clean_sku(PDO $pdo, int $cid, $raw, ?int $ignoreId = null): ?string
{
    $sku = trim((string) $raw);
    if ($sku === '') return null;
    if (mb_strlen($sku) > 60) json_error('SKU is too long (max 60).', 422);
    $sql = 'SELECT id FROM pos_products WHERE company_id = ? AND sku = ?';
    $params = [$cid, $sku];
    if ($ignoreId) {
        $sql .= ' AND id <> ?';
        $params[] = $ignoreId;
    }
    $chk = $pdo->prepare($sql);
    $chk->execute($params);
    if ($chk->fetch()) json_error('That SKU is already used by another product.', 422);
    return $sku;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    json_out(['products' => pos_products_list($pdo, $cid)]);
}

if ($method === 'POST') {
    $in    = json_in();
    $name  = trim((string) ($in['name'] ?? ''));
    if ($name === '')            json_error('Please enter the product name.', 422);
    if (mb_strlen($name) > 150)  json_error('The product name is too long (max 150).', 422);
    $price = (float) ($in['price'] ?? 0);
    if ($price < 0)              json_error('Price cannot be negative.', 422);
    $stock = (int) ($in['stock'] ?? 0);
    $sku   = pos_clean_sku($pdo, $cid, $in['sku'] ?? '');

    $count = (int) $pdo->query("SELECT COUNT(*) FROM pos_products WHERE company_id = $cid")->fetchColumn();
    if ($count >= MAX_POS_PRODUCTS) json_error('You have reached the maximum number of products.', 422);

    $pdo->prepare(
        'INSERT INTO pos_products (company_id, name, sku, price, stock) VALUES (?, ?, ?, ?, ?)'
    )->execute([$cid, $name, $sku, $price, $stock]);

    json_out(['products' => pos_products_list($pdo, $cid)], 201);
}

if ($method === 'PUT') {
    $id  = (int) ($_GET['id'] ?? 0);
    $own = $pdo->prepare('SELECT id FROM pos_products WHERE id = ? AND company_id = ?');
    $own->execute([$id, $cid]);
    if (!$own->fetch()) json_error('Product not found', 404);

    $in = json_in();
    $fields = [];
    $params = [];
    if (array_key_exists('name', $in)) {
        $name = trim((string) $in['name']);
        if ($name === '' || mb_strlen($name) > 150) json_error('Enter a valid product name.', 422);
        $fields[] = 'name = ?';
        $params[] = $name;
    }
    if (array_key_exists('sku', $in)) {
        $fields[] = 'sku = ?';
        $params[] = pos_clean_sku($pdo, $cid, $in['sku'], $id);
    }
    if (array_key_exists('price', $in)) {
        $price = (float) $in['price'];
        if ($price < 0) json_error('Price cannot be negative.', 422);
        $fields[] = 'price = ?';
        $params[] = $price;
    }
    if (array_key_exists('stock', $in)) {
        $fields[] = 'stock = ?';
        $params[] = (int) $in['stock'];
    }
    if (array_key_exists('is_active', $in)) {
        $fields[] = 'is_active = ?';
        $params[] = $in['is_active'] ? 1 : 0;
    }
    if (!$fields) json_error('Nothing to update', 422);

    $params[] = $id;
    $pdo->prepare('UPDATE pos_products SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    json_out(['products' => pos_products_list($pdo, $cid)]);
}

if ($method === 'DELETE') {
    $id  = (int) ($_GET['id'] ?? 0);
    $own = $pdo->prepare('SELECT id FROM pos_products WHERE id = ? AND company_id = ?');
    $own->execute([$id, $cid]);
    if (!$own->fetch()) json_error('Product not found', 404);

    $pdo->prepare('DELETE FROM pos_products WHERE id = ?')->execute([$id]);
    json_out(['products' => pos_products_list($pdo, $cid)]);
}

json_error('Method not allowed', 405);
