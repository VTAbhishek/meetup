<?php
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/urls.php';
require_once __DIR__ . '/../helpers/covers.php';
require_once __DIR__ . '/../helpers/moods.php';

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$stmt = db()->prepare(
    'SELECT c.*, d.name AS district_name, ci.name AS city_name
     FROM companies c
     LEFT JOIN districts d ON d.id  = c.district_id
     LEFT JOIN cities ci   ON ci.id = c.city_id
     WHERE c.user_id = ?'
);
$stmt->execute([$user['id']]);
$company = $stmt->fetch();

if (!$company) {
    json_out(['company' => null, 'reviews' => [], 'stats' => ['avg_rating' => 0, 'review_count' => 0]]);
}
$cid = (int) $company['id'];

// Public-facing stats use approved reviews only.
$agg = db()->prepare('SELECT COALESCE(ROUND(AVG(rating),1),0) AS avg_rating, COUNT(*) AS review_count FROM reviews WHERE company_id = ? AND is_approved = 1');
$agg->execute([$cid]);
$stats = $agg->fetch();

$pending = (int) db()->query("SELECT COUNT(*) FROM reviews WHERE company_id = $cid AND is_approved = 0")->fetchColumn();

$breakdown = [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0];
$bd = db()->prepare('SELECT rating, COUNT(*) AS n FROM reviews WHERE company_id = ? AND is_approved = 1 GROUP BY rating');
$bd->execute([$cid]);
foreach ($bd->fetchAll() as $r) $breakdown[(int) $r['rating']] = (int) $r['n'];

$rev = db()->prepare(
    "SELECT r.id, r.rating, r.title, r.body, r.is_approved, r.sort_order, r.useful_count, r.created_at,
            u.full_name AS customer_name,
            rr.body AS reply_body, rr.created_at AS reply_at
     FROM reviews r
     JOIN users u ON u.id = r.customer_id
     LEFT JOIN review_replies rr ON rr.review_id = r.id
     WHERE r.company_id = ?
     ORDER BY r.is_approved ASC, r.created_at DESC"
);
$rev->execute([$cid]);
$reviews = array_map(function ($r) {
    return [
        'id'            => (int) $r['id'],
        'rating'        => (int) $r['rating'],
        'title'         => $r['title'],
        'body'          => $r['body'],
        'is_approved'   => (bool) $r['is_approved'],
        'sort_order'    => (int) $r['sort_order'],
        'useful_count'  => (int) $r['useful_count'],
        'created_at'    => $r['created_at'],
        'customer_name' => $r['customer_name'],
        'reply'         => $r['reply_body'] ? ['body' => $r['reply_body'], 'created_at' => $r['reply_at']] : null,
    ];
}, $rev->fetchAll());

json_out([
    'company' => [
        'id'           => $cid,
        'company_name' => $company['company_name'],
        'slug'         => $company['slug'],
        'website'      => $company['website'],
        'category'     => $company['category'],
        'description'  => $company['description'],
        'about_html'   => $company['about'],
        'phone'        => $company['phone'],
        'address'      => $company['address'],
        'district_name'=> $company['district_name'],
        'city_name'    => $company['city_name'],
        // isset() guards a database that hasn't run migration 001 yet — an
        // undefined key would emit a PHP warning that corrupts the JSON body.
        'latitude'     => isset($company['latitude'])  ? (float) $company['latitude']  : null,
        'longitude'    => isset($company['longitude']) ? (float) $company['longitude'] : null,
        'map_zoom'     => (int) ($company['map_zoom'] ?? 16),
        'logo'         => $company['logo'],
        'logo_url'     => asset_url($company['logo']),
        'cover_video'     => $company['cover_video'] ?? null,
        'cover_video_url' => asset_url($company['cover_video'] ?? null),
        'covers'       => company_cover_list(db(), $cid),
        'moods'        => company_moods(db(), $cid),
        'status'       => $company['status'],
    ],
    'stats'   => [
        'avg_rating'   => (float) $stats['avg_rating'],
        'review_count' => (int) $stats['review_count'],
        'pending'      => $pending,
    ],
    'breakdown' => $breakdown,
    'reviews'   => $reviews,
]);
