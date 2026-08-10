<?php
/**
 * Company cover gallery (one or more banner images shown as a slideshow).
 *   GET                       -> { covers: [{id,url}] }
 *   POST (multipart "covers[]") -> add one or more images
 *   DELETE ?id=               -> remove one cover
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/upload.php';
require_once __DIR__ . '/../helpers/covers.php';

const MAX_COVERS = 5;
const COVER_MAX_BYTES = 20 * 1024 * 1024; // 20 MB each

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$pdo = db();
$stmt = $pdo->prepare('SELECT id FROM companies WHERE user_id = ?');
$stmt->execute([$user['id']]);
$cid = (int) ($stmt->fetchColumn() ?: 0);
if (!$cid) json_error('Company not found', 404);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    json_out(['covers' => company_cover_list($pdo, $cid)]);
}

if ($method === 'POST') {
    if (empty($_FILES['covers'])) json_error('No images were uploaded.', 422);
    $files = array_filter(
        normalize_files($_FILES['covers']),
        fn ($f) => ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE
    );
    if (!$files) json_error('No images were uploaded.', 422);

    $existing = (int) $pdo->query("SELECT COUNT(*) FROM company_covers WHERE company_id = $cid")->fetchColumn();
    if ($existing + count($files) > MAX_COVERS) {
        json_error('You can have at most ' . MAX_COVERS . ' cover images.', 422);
    }

    $order = (int) $pdo->query("SELECT COALESCE(MAX(sort_order), 0) FROM company_covers WHERE company_id = $cid")->fetchColumn();
    foreach ($files as $file) {
        $rel = store_image_file($file, 'covers', COVER_MAX_BYTES, 'cover_' . $cid);
        $order++;
        $pdo->prepare('INSERT INTO company_covers (company_id, path, sort_order) VALUES (?, ?, ?)')
            ->execute([$cid, $rel, $order]);
    }
    json_out(['covers' => company_cover_list($pdo, $cid)], 201);
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    $row = $pdo->prepare('SELECT path FROM company_covers WHERE id = ? AND company_id = ?');
    $row->execute([$id, $cid]);
    $path = $row->fetchColumn();
    if ($path === false) json_error('Cover not found', 404);

    delete_asset_file($path);
    $pdo->prepare('DELETE FROM company_covers WHERE id = ?')->execute([$id]);
    json_out(['covers' => company_cover_list($pdo, $cid)]);
}

json_error('Method not allowed', 405);
