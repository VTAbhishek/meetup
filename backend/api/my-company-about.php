<?php
/**
 * Rich "About us" content for the logged-in company.
 *   POST { about: "<html…>" } -> sanitise + save (empty string clears it)
 * Returns { about_html }.
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/sanitize.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$stmt = db()->prepare('SELECT id FROM companies WHERE user_id = ?');
$stmt->execute([$user['id']]);
$cid = (int) ($stmt->fetchColumn() ?: 0);
if (!$cid) json_error('Company not found', 404);

$in    = json_in();
$about = (string) ($in['about'] ?? '');
if (mb_strlen($about) > 60000) json_error('About text is too long.', 422);

$clean = sanitize_html($about);

db()->prepare('UPDATE companies SET about = ? WHERE id = ?')
    ->execute([$clean !== '' ? $clean : null, $cid]);

json_out(['about_html' => $clean !== '' ? $clean : null]);
