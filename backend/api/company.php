<?php
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/urls.php';
require_once __DIR__ . '/../helpers/covers.php';
require_once __DIR__ . '/../helpers/hours.php';
require_once __DIR__ . '/../helpers/moods.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$slug = trim($_GET['slug'] ?? '');
$id   = (int) ($_GET['id'] ?? 0);

$sql = 'SELECT c.*, d.name AS district_name, ci.name AS city_name
        FROM companies c
        LEFT JOIN districts d ON d.id = c.district_id
        LEFT JOIN cities ci   ON ci.id = c.city_id
        WHERE ';
if ($slug !== '') {
    $stmt = db()->prepare($sql . 'c.slug = ?');
    $stmt->execute([$slug]);
} else {
    $stmt = db()->prepare($sql . 'c.id = ?');
    $stmt->execute([$id]);
}
$company = $stmt->fetch();
if (!$company) json_error('Company not found', 404);
if (($company['status'] ?? 'active') !== 'active') json_error('Company not available', 404);
$cid = (int) $company['id'];

// Aggregate + star breakdown (approved reviews only)
$agg = db()->prepare('SELECT COALESCE(ROUND(AVG(rating),1),0) AS avg_rating, COUNT(*) AS review_count FROM reviews WHERE company_id = ? AND is_approved = 1');
$agg->execute([$cid]);
$a = $agg->fetch();

$breakdown = [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0];
$bd = db()->prepare('SELECT rating, COUNT(*) AS n FROM reviews WHERE company_id = ? AND is_approved = 1 GROUP BY rating');
$bd->execute([$cid]);
foreach ($bd->fetchAll() as $r) {
    $breakdown[(int) $r['rating']] = (int) $r['n'];
}

// Filters / sorting for the review list
$filterRating = (int) ($_GET['rating'] ?? 0);
$sort = $_GET['sort'] ?? 'featured';
$orderSql = $sort === 'highest' ? 'r.rating DESC, r.created_at DESC'
          : ($sort === 'lowest' ? 'r.rating ASC, r.created_at DESC'
          : ($sort === 'useful' ? 'r.useful_count DESC, r.created_at DESC'
          : ($sort === 'recent' ? 'r.created_at DESC'
          : 'r.sort_order ASC, r.created_at DESC'))); // featured = company's custom order

$rWhere  = 'r.company_id = ? AND r.is_approved = 1';
$rParams = [$cid];
if ($filterRating >= 1 && $filterRating <= 5) {
    $rWhere .= ' AND r.rating = ?';
    $rParams[] = $filterRating;
}

$rev = db()->prepare(
    "SELECT r.id, r.rating, r.title, r.body, r.useful_count, r.experience_date, r.created_at,
            u.full_name AS customer_name,
            rr.body AS reply_body, rr.created_at AS reply_at, rr.rating AS reply_rating
     FROM reviews r
     JOIN users u ON u.id = r.customer_id
     LEFT JOIN review_replies rr ON rr.review_id = r.id
     WHERE $rWhere
     ORDER BY $orderSql
     LIMIT 100"
);
$rev->execute($rParams);
$reviews = array_map(function ($r) {
    return [
        'id'              => (int) $r['id'],
        'rating'          => (int) $r['rating'],
        'title'           => $r['title'],
        'body'            => $r['body'],
        'useful_count'    => (int) $r['useful_count'],
        'experience_date' => $r['experience_date'],
        'created_at'      => $r['created_at'],
        'customer_name'   => $r['customer_name'],
        'reply'           => $r['reply_body'] ? [
            'body' => $r['reply_body'],
            'created_at' => $r['reply_at'],
            'rating' => $r['reply_rating'] !== null ? (int) $r['reply_rating'] : null
        ] : null,
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
        // isset() guards a database that hasn't run migration 001 yet — an undefined
        // key would emit a PHP warning that corrupts the JSON body.
        'latitude'     => isset($company['latitude'])  ? (float) $company['latitude']  : null,
        'longitude'    => isset($company['longitude']) ? (float) $company['longitude'] : null,
        'map_zoom'     => (int) ($company['map_zoom'] ?? 16),
        'logo_url'     => asset_url($company['logo']),
        'cover_video_url' => asset_url($company['cover_video'] ?? null),
        'covers'       => company_cover_urls(db(), $cid),
        'cards'        => array_map(function ($r) {
            return [
                'id'        => (int) $r['id'],
                'title'     => $r['title'],
                'intro'     => $r['intro'],
                'thumb_url' => asset_url($r['thumb']),
                'image_url' => asset_url($r['image'] ?: $r['thumb']),
            ];
        }, (function () use ($cid) {
            $s = db()->prepare('SELECT id, title, intro, thumb, image FROM company_cards WHERE company_id = ? ORDER BY sort_order, id');
            $s->execute([$cid]);
            return $s->fetchAll();
        })()),
        'moods'        => company_moods(db(), $cid),
        'hours'        => array_values(company_weekly_hours(db(), $cid)),
        'open_status'  => company_open_status(db(), $cid),
        'claimed'      => (bool) $company['user_id'],
        'avg_rating'   => (float) $a['avg_rating'],
        'review_count' => (int) $a['review_count'],
        'breakdown'    => $breakdown,
    ],
    'reviews' => $reviews,
]);
