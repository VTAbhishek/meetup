<?php
/**
 * Showcase cards for the logged-in company (shown on the public page).
 *   GET  -> { cards: [{id,title,intro,thumb_url,image_url}] }
 *   POST multipart: title, intro?, thumb (card image), image? (shown on click)
 *   DELETE ?id=
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/upload.php';

const MAX_CARDS = 10;
const CARD_IMG_MAX = 10 * 1024 * 1024; // 10 MB each

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$pdo = db();
$stmt = $pdo->prepare('SELECT id FROM companies WHERE user_id = ?');
$stmt->execute([$user['id']]);
$cid = (int) ($stmt->fetchColumn() ?: 0);
if (!$cid) json_error('Company not found', 404);

function cards_list(PDO $pdo, int $cid): array
{
    $stmt = $pdo->prepare(
        'SELECT id, title, intro, thumb, image FROM company_cards WHERE company_id = ? ORDER BY sort_order, id'
    );
    $stmt->execute([$cid]);
    return array_map(fn ($r) => [
        'id'        => (int) $r['id'],
        'title'     => $r['title'],
        'intro'     => $r['intro'],
        'thumb_url' => asset_url($r['thumb']),
        'image_url' => asset_url($r['image'] ?: $r['thumb']),
    ], $stmt->fetchAll());
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    json_out(['cards' => cards_list($pdo, $cid)]);
}

if ($method === 'POST') {
    $title = trim($_POST['title'] ?? '');
    $intro = trim($_POST['intro'] ?? '');
    if ($title === '')            json_error('A topic/title is required.', 422);
    if (mb_strlen($title) > 100)  json_error('The topic is too long (max 100 characters).', 422);
    if (mb_strlen($intro) > 300)  json_error('The introduction is too long (max 300 characters).', 422);

    $count = (int) $pdo->query("SELECT COUNT(*) FROM company_cards WHERE company_id = $cid")->fetchColumn();
    if ($count >= MAX_CARDS) json_error('You can have at most ' . MAX_CARDS . ' cards.', 422);

    if (empty($_FILES['thumb'])) json_error('Please add the card image.', 422);
    $thumb = store_image_file($_FILES['thumb'], 'cards', CARD_IMG_MAX, 'card_' . $cid);

    $image = null;
    if (!empty($_FILES['image']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        $image = store_image_file($_FILES['image'], 'cards', CARD_IMG_MAX, 'cardfull_' . $cid);
    }

    $order = (int) $pdo->query("SELECT COALESCE(MAX(sort_order),0) FROM company_cards WHERE company_id = $cid")->fetchColumn();
    $pdo->prepare(
        'INSERT INTO company_cards (company_id, title, intro, thumb, image, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$cid, $title, $intro !== '' ? $intro : null, $thumb, $image, $order + 1]);

    json_out(['cards' => cards_list($pdo, $cid)], 201);
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    $row = $pdo->prepare('SELECT thumb, image FROM company_cards WHERE id = ? AND company_id = ?');
    $row->execute([$id, $cid]);
    $card = $row->fetch();
    if (!$card) json_error('Card not found', 404);

    delete_asset_file($card['thumb']);
    delete_asset_file($card['image']);
    $pdo->prepare('DELETE FROM company_cards WHERE id = ?')->execute([$id]);
    json_out(['cards' => cards_list($pdo, $cid)]);
}

json_error('Method not allowed', 405);
