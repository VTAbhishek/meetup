<?php
/**
 * Shared handler for company image uploads (logo + cover).
 *   POST (multipart field named after $field) -> save/replace
 *   DELETE                                     -> remove
 * Returns { <field>, <field>_url }.
 *
 * $field is whitelisted, so interpolating it into the SQL below is safe.
 */
require_once __DIR__ . '/urls.php';

/**
 * Validate + store one uploaded file (a single $_FILES entry), returning its
 * stored relative path. json_error()s out on any problem.
 */
function store_image_file(array $file, string $subdir, int $maxBytes, string $prefix = ''): string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        json_error('No image was uploaded.', 422);
    }
    if ($file['size'] > $maxBytes) {
        json_error('Image is too large (max ' . round($maxBytes / 1048576) . ' MB).', 422);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime  = $finfo->file($file['tmp_name']);
    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    if (!isset($allowed[$mime])) json_error('Only JPG, PNG, WEBP or GIF images are allowed.', 422);
    $ext = $allowed[$mime];

    $dir = __DIR__ . '/../uploads/' . $subdir;
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        json_error('Upload folder is not available.', 500);
    }

    $name = ($prefix !== '' ? $prefix . '_' : '') . bin2hex(random_bytes(6)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) {
        json_error('Could not save the image.', 500);
    }
    return 'uploads/' . $subdir . '/' . $name;
}

/** Validate + store a single uploaded image by its form field name. */
function save_uploaded_image(string $fieldName, string $subdir, int $maxBytes, string $prefix = ''): string
{
    if (empty($_FILES[$fieldName])) json_error('No image was uploaded.', 422);
    return store_image_file($_FILES[$fieldName], $subdir, $maxBytes, $prefix);
}

/** Turn a $_FILES entry (single or multiple[]) into a flat list of file arrays. */
function normalize_files(array $f): array
{
    if (isset($f['name']) && is_array($f['name'])) {
        $out = [];
        foreach ($f['name'] as $i => $name) {
            $out[] = [
                'name'     => $name,
                'type'     => $f['type'][$i] ?? '',
                'tmp_name' => $f['tmp_name'][$i] ?? '',
                'error'    => $f['error'][$i] ?? UPLOAD_ERR_NO_FILE,
                'size'     => $f['size'][$i] ?? 0,
            ];
        }
        return $out;
    }
    return [$f];
}

/** Delete a stored relative asset file if it exists. */
function delete_asset_file(?string $rel): void
{
    if (!empty($rel)) {
        $p = __DIR__ . '/../' . $rel;
        if (is_file($p)) @unlink($p);
    }
}

/** Upload/replace/delete handler for a company's logo or cover column. */
function company_image_endpoint(string $field, string $subdir, int $maxBytes): void
{
    if (!in_array($field, ['logo', 'cover'], true)) json_error('Bad request', 400);

    $user = require_api_user();
    if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

    $stmt = db()->prepare("SELECT id, $field AS current FROM companies WHERE user_id = ?");
    $stmt->execute([$user['id']]);
    $company = $stmt->fetch();
    if (!$company) json_error('Company not found', 404);
    $cid = (int) $company['id'];

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'POST') {
        $rel = save_uploaded_image($field, $subdir, $maxBytes, $field . '_' . $cid);
        delete_asset_file($company['current']);
        db()->prepare("UPDATE companies SET $field = ? WHERE id = ?")->execute([$rel, $cid]);
        json_out([$field => $rel, $field . '_url' => asset_url($rel)]);
    }

    if ($method === 'DELETE') {
        delete_asset_file($company['current']);
        db()->prepare("UPDATE companies SET $field = NULL WHERE id = ?")->execute([$cid]);
        json_out(['ok' => true, $field => null, $field . '_url' => null]);
    }

    json_error('Method not allowed', 405);
}
