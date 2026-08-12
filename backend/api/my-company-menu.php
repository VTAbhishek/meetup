<?php
/**
 * Menu items for the logged-in COMPANY (shown to customers for pre-ordering).
 *   GET               -> { items: [{id,category,name,price,image_url,is_available,sort_order}] }
 *   POST (multipart)  -> add one item: name, category, price, image? (add one-by-one)
 *   POST ?id=         -> update an item: is_available?, price?, name?, category?,
 *                        image? (replaces the photo), remove_image? (clears it)
 *                        Accepts JSON or multipart: the availability switch posts
 *                        JSON { is_available }, the edit form posts a multipart
 *                        body because it can carry a new photo.
 *   DELETE ?id=       -> remove the item (and its image file)
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/upload.php';

const MAX_MENU_ITEMS = 200;
const MENU_IMG_MAX = 10 * 1024 * 1024; // 10 MB

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$pdo = db();
$stmt = $pdo->prepare('SELECT id FROM companies WHERE user_id = ?');
$stmt->execute([$user['id']]);
$cid = (int) ($stmt->fetchColumn() ?: 0);
if (!$cid) json_error('Company not found', 404);

function menu_list(PDO $pdo, int $cid): array
{
    $stmt = $pdo->prepare(
        'SELECT id, category, name, price, image, is_available, sort_order
         FROM menu_items WHERE company_id = ? ORDER BY category, sort_order, id'
    );
    $stmt->execute([$cid]);
    return array_map(fn ($r) => [
        'id'           => (int) $r['id'],
        'category'     => $r['category'],
        'name'         => $r['name'],
        'price'        => (float) $r['price'],
        'image_url'    => $r['image'] ? asset_url($r['image']) : null,
        'is_available' => (int) $r['is_available'] === 1,
        'sort_order'   => (int) $r['sort_order'],
    ], $stmt->fetchAll());
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    json_out(['items' => menu_list($pdo, $cid)]);
}

// ---- Update an existing item (availability toggle / edit) ----
if ($method === 'POST' && isset($_GET['id'])) {
    $id  = (int) $_GET['id'];
    $own = $pdo->prepare('SELECT id, image FROM menu_items WHERE id = ? AND company_id = ?');
    $own->execute([$id, $cid]);
    $current = $own->fetch();
    if (!$current) json_error('Item not found', 404);

    // The edit form has to send multipart (it may carry a photo), while the
    // availability switch sends JSON. PHP fills $_POST/$_FILES for the former
    // and leaves both empty for the latter, which is what tells them apart.
    $in = (!empty($_POST) || !empty($_FILES)) ? $_POST : json_in();

    $fields = [];
    $params = [];
    if (array_key_exists('is_available', $in)) {
        $fields[] = 'is_available = ?';
        $params[] = $in['is_available'] ? 1 : 0;
    }
    if (array_key_exists('name', $in)) {
        $name = trim((string) $in['name']);
        if ($name === '' || mb_strlen($name) > 120) json_error('Enter a valid item name.', 422);
        $fields[] = 'name = ?';
        $params[] = $name;
    }
    if (array_key_exists('category', $in)) {
        $cat = trim((string) $in['category']);
        if ($cat === '' || mb_strlen($cat) > 80) json_error('Enter a valid category.', 422);
        $fields[] = 'category = ?';
        $params[] = $cat;
    }
    if (array_key_exists('price', $in)) {
        $price = (float) $in['price'];
        if ($price < 0) json_error('Price cannot be negative.', 422);
        $fields[] = 'price = ?';
        $params[] = $price;
    }

    // ---- Photo: replace, or clear ----
    // The old file is only unlinked once the new one is safely stored, so a
    // failed upload leaves the item with the picture it already had.
    $hasUpload = !empty($_FILES['image']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
    if ($hasUpload) {
        $stored = store_image_file($_FILES['image'], 'menu', MENU_IMG_MAX, 'menu_' . $cid);
        delete_asset_file($current['image']);
        $fields[] = 'image = ?';
        $params[] = $stored;
    } elseif (!empty($in['remove_image'])) {
        delete_asset_file($current['image']);
        $fields[] = 'image = ?';
        $params[] = null;
    }

    if (!$fields) json_error('Nothing to update', 422);

    $params[] = $id;
    $pdo->prepare('UPDATE menu_items SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    json_out(['items' => menu_list($pdo, $cid)]);
}

// ---- Add one item ----
if ($method === 'POST') {
    $name     = trim($_POST['name'] ?? '');
    $category = trim($_POST['category'] ?? '');
    $price    = (float) ($_POST['price'] ?? 0);

    if ($name === '')             json_error('Please enter the item name.', 422);
    if (mb_strlen($name) > 120)   json_error('The item name is too long (max 120).', 422);
    if ($category === '')         json_error('Please choose or enter a category.', 422);
    if (mb_strlen($category) > 80) json_error('The category is too long (max 80).', 422);
    if ($price < 0)               json_error('Price cannot be negative.', 422);

    $count = (int) $pdo->query("SELECT COUNT(*) FROM menu_items WHERE company_id = $cid")->fetchColumn();
    if ($count >= MAX_MENU_ITEMS) json_error('You have reached the maximum number of menu items.', 422);

    $image = null;
    if (!empty($_FILES['image']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        $image = store_image_file($_FILES['image'], 'menu', MENU_IMG_MAX, 'menu_' . $cid);
    }

    $order = (int) $pdo->query("SELECT COALESCE(MAX(sort_order),0) FROM menu_items WHERE company_id = $cid")->fetchColumn();
    $pdo->prepare(
        'INSERT INTO menu_items (company_id, category, name, price, image, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$cid, $category, $name, $price, $image, $order + 1]);

    json_out(['items' => menu_list($pdo, $cid)], 201);
}

if ($method === 'DELETE') {
    $id  = (int) ($_GET['id'] ?? 0);
    $row = $pdo->prepare('SELECT image FROM menu_items WHERE id = ? AND company_id = ?');
    $row->execute([$id, $cid]);
    $item = $row->fetch();
    if (!$item) json_error('Item not found', 404);

    delete_asset_file($item['image']);
    $pdo->prepare('DELETE FROM menu_items WHERE id = ?')->execute([$id]);
    json_out(['items' => menu_list($pdo, $cid)]);
}

json_error('Method not allowed', 405);
