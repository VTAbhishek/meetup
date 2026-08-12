<?php
/**
 * Bookable tables for the logged-in COMPANY.
 *   GET               -> { tables: [{id,category,table_no,seats,note,image_url,qr_token,is_active,sort_order}] }
 *   POST (multipart)  -> add one table: category, table_no, seats, note?, image?
 *   POST ?id=         -> update a table: is_active?, category?, table_no?, seats?,
 *                        note?, image? (replaces the photo), remove_image? (clears it)
 *                        Accepts JSON or multipart: the bookable switch posts
 *                        JSON { is_active }, the edit form posts multipart
 *                        because it can carry a new photo.
 *                        The table's qr_token is never touched, so cards already
 *                        printed and standing on tables keep working.
 *   DELETE ?id=       -> remove the table (and its image file)
 *
 * Reservations that already booked a deleted table keep their snapshotted
 * `table_label`; the FK nulls their `table_id`.
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/upload.php';
require_once __DIR__ . '/../helpers/tables.php';

const MAX_TABLES     = 300;
const TABLE_IMG_MAX  = 10 * 1024 * 1024; // 10 MB

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$pdo  = db();
$stmt = $pdo->prepare('SELECT id FROM companies WHERE user_id = ?');
$stmt->execute([$user['id']]);
$cid = (int) ($stmt->fetchColumn() ?: 0);
if (!$cid) json_error('Company not found', 404);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    json_out(['tables' => company_table_list($pdo, $cid)]);
}

// ---- Update an existing table (availability toggle / edit) ----
if ($method === 'POST' && isset($_GET['id'])) {
    $id  = (int) $_GET['id'];
    $own = $pdo->prepare('SELECT id, image FROM company_tables WHERE id = ? AND company_id = ?');
    $own->execute([$id, $cid]);
    $current = $own->fetch();
    if (!$current) json_error('Table not found', 404);

    // The edit form has to send multipart (it may carry a photo), while the
    // bookable switch sends JSON. PHP fills $_POST/$_FILES for the former and
    // leaves both empty for the latter, which is what tells them apart.
    $in = (!empty($_POST) || !empty($_FILES)) ? $_POST : json_in();

    $fields = [];
    $params = [];

    if (array_key_exists('is_active', $in)) {
        $fields[] = 'is_active = ?';
        $params[] = $in['is_active'] ? 1 : 0;
    }
    if (array_key_exists('category', $in)) {
        $cat = trim((string) $in['category']);
        if ($cat === '' || mb_strlen($cat) > 60) json_error('Enter a valid category.', 422);
        $fields[] = 'category = ?';
        $params[] = $cat;
    }
    if (array_key_exists('table_no', $in)) {
        $no = trim((string) $in['table_no']);
        if ($no === '' || mb_strlen($no) > 30) json_error('Enter a valid table number.', 422);
        // The (company_id, table_no) unique key would throw a raw SQL error;
        // check first so the company gets a readable message.
        $dupe = $pdo->prepare('SELECT id FROM company_tables WHERE company_id = ? AND table_no = ? AND id <> ?');
        $dupe->execute([$cid, $no, $id]);
        if ($dupe->fetchColumn()) json_error('You already have a table numbered "' . $no . '".', 422);
        $fields[] = 'table_no = ?';
        $params[] = $no;
    }
    if (array_key_exists('seats', $in)) {
        $seats = (int) $in['seats'];
        if ($seats < 1 || $seats > 99) json_error('Seats must be between 1 and 99.', 422);
        $fields[] = 'seats = ?';
        $params[] = $seats;
    }
    if (array_key_exists('note', $in)) {
        $note = trim((string) $in['note']);
        if (mb_strlen($note) > 200) json_error('The note is too long (max 200).', 422);
        $fields[] = 'note = ?';
        $params[] = $note !== '' ? $note : null;
    }

    // ---- Photo: replace, or clear ----
    // The old file is only unlinked once the new one is safely stored, so a
    // failed upload leaves the table with the picture it already had.
    $hasUpload = !empty($_FILES['image']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
    if ($hasUpload) {
        $stored = store_image_file($_FILES['image'], 'tables', TABLE_IMG_MAX, 'table_' . $cid);
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
    $pdo->prepare('UPDATE company_tables SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    json_out(['tables' => company_table_list($pdo, $cid)]);
}

// ---- Add one table ----
if ($method === 'POST') {
    $category = trim($_POST['category'] ?? '');
    $tableNo  = trim($_POST['table_no'] ?? '');
    $seats    = (int) ($_POST['seats'] ?? 2);
    $note     = trim($_POST['note'] ?? '');

    if ($category === '')            json_error('Please choose or enter a table category (e.g. VIP).', 422);
    if (mb_strlen($category) > 60)   json_error('The category is too long (max 60).', 422);
    if ($tableNo === '')             json_error('Please enter the table number.', 422);
    if (mb_strlen($tableNo) > 30)    json_error('The table number is too long (max 30).', 422);
    if ($seats < 1 || $seats > 99)   json_error('Seats must be between 1 and 99.', 422);
    if (mb_strlen($note) > 200)      json_error('The note is too long (max 200).', 422);

    $dupe = $pdo->prepare('SELECT id FROM company_tables WHERE company_id = ? AND table_no = ?');
    $dupe->execute([$cid, $tableNo]);
    if ($dupe->fetchColumn()) json_error('You already have a table numbered "' . $tableNo . '".', 422);

    $count = (int) $pdo->query("SELECT COUNT(*) FROM company_tables WHERE company_id = $cid")->fetchColumn();
    if ($count >= MAX_TABLES) json_error('You have reached the maximum number of tables.', 422);

    $image = null;
    if (!empty($_FILES['image']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        $image = store_image_file($_FILES['image'], 'tables', TABLE_IMG_MAX, 'table_' . $cid);
    }

    $order = (int) $pdo->query("SELECT COALESCE(MAX(sort_order),0) FROM company_tables WHERE company_id = $cid")->fetchColumn();
    // Minted here, at creation, so every table has a printable QR code from the
    // moment it exists — there is no "generate code" step to forget.
    $pdo->prepare(
        'INSERT INTO company_tables (company_id, category, table_no, seats, note, image, qr_token, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([$cid, $category, $tableNo, $seats, $note ?: null, $image, new_table_qr_token($pdo), $order + 1]);

    json_out(['tables' => company_table_list($pdo, $cid)], 201);
}

if ($method === 'DELETE') {
    $id  = (int) ($_GET['id'] ?? 0);
    $row = $pdo->prepare('SELECT image FROM company_tables WHERE id = ? AND company_id = ?');
    $row->execute([$id, $cid]);
    $table = $row->fetch();
    if (!$table) json_error('Table not found', 404);

    delete_asset_file($table['image']);
    $pdo->prepare('DELETE FROM company_tables WHERE id = ?')->execute([$id]);
    json_out(['tables' => company_table_list($pdo, $cid)]);
}

json_error('Method not allowed', 405);
