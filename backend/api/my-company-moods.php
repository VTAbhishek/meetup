<?php
/**
 * Mood tags for the logged-in COMPANY.
 *   GET  -> { moods: [...all moods...], selected: [id, ...] }
 *   POST -> replace the selection: { mood_ids: [1,3] } -> same shape back
 *
 * The company ticks whichever moods its venue suits; customers filter on them.
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/moods.php';

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$pdo  = db();
$stmt = $pdo->prepare('SELECT id FROM companies WHERE user_id = ?');
$stmt->execute([$user['id']]);
$cid = (int) ($stmt->fetchColumn() ?: 0);
if (!$cid) json_error('Company not found', 404);

/** Both verbs answer with the full picture, so the client never refetches. */
function moods_payload(PDO $pdo, int $cid): array
{
    return [
        'moods'    => mood_catalogue($pdo),
        'selected' => array_column(company_moods($pdo, $cid), 'id'),
    ];
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    json_out(moods_payload($pdo, $cid));
}

if ($method === 'POST') {
    $in  = json_in();
    $ids = is_array($in['mood_ids'] ?? null) ? $in['mood_ids'] : [];

    try {
        set_company_moods($pdo, $cid, $ids);
    } catch (Throwable $e) {
        json_error('Could not save your moods. Please try again.', 500);
    }

    json_out(moods_payload($pdo, $cid));
}

json_error('Method not allowed', 405);
