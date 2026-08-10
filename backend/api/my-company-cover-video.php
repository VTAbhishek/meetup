<?php
/**
 * Auto-generated cover video (a short animated montage built from the company's
 * cover images by the browser, then uploaded here).
 *   POST (multipart "video") -> store/replace the cover video
 *   DELETE                    -> remove it
 * Returns { cover_video, cover_video_url }.
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/upload.php';

const COVER_VIDEO_MAX_BYTES = 60 * 1024 * 1024; // 60 MB

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$pdo = db();
$stmt = $pdo->prepare('SELECT id, cover_video FROM companies WHERE user_id = ?');
$stmt->execute([$user['id']]);
$company = $stmt->fetch();
if (!$company) json_error('Company not found', 404);
$cid = (int) $company['id'];

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    if (empty($_FILES['video'])) json_error('No video was uploaded.', 422);
    $file = $_FILES['video'];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) json_error('Upload failed.', 422);
    if ($file['size'] > COVER_VIDEO_MAX_BYTES) {
        json_error('Video is too large (max ' . round(COVER_VIDEO_MAX_BYTES / 1048576) . ' MB).', 422);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime  = $finfo->file($file['tmp_name']);
    $allowed = ['video/webm' => 'webm', 'video/mp4' => 'mp4'];
    if (!isset($allowed[$mime])) json_error('Only WEBM or MP4 videos are allowed.', 422);
    $ext = $allowed[$mime];

    $dir = __DIR__ . '/../uploads/cover-videos';
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        json_error('Upload folder is not available.', 500);
    }
    $name = 'cover_' . $cid . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) {
        json_error('Could not save the video.', 500);
    }
    $rel = 'uploads/cover-videos/' . $name;

    delete_asset_file($company['cover_video']);
    $pdo->prepare('UPDATE companies SET cover_video = ? WHERE id = ?')->execute([$rel, $cid]);
    json_out(['cover_video' => $rel, 'cover_video_url' => asset_url($rel)], 201);
}

if ($method === 'DELETE') {
    delete_asset_file($company['cover_video']);
    $pdo->prepare('UPDATE companies SET cover_video = NULL WHERE id = ?')->execute([$cid]);
    json_out(['ok' => true, 'cover_video' => null, 'cover_video_url' => null]);
}

json_error('Method not allowed', 405);
