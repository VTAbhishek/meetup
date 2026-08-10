<?php
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/urls.php';
require_once __DIR__ . '/../helpers/hours.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$q          = trim($_GET['q'] ?? '');
$category    = trim($_GET['category'] ?? '');
$districtId  = (int) ($_GET['district_id'] ?? 0);
$cityId      = (int) ($_GET['city_id'] ?? 0);
$limit       = min(50, max(1, (int) ($_GET['limit'] ?? 24)));

$where  = ["c.status = 'active'"]; // only active companies are public
$params = [];
if ($q !== '') {
    $where[] = '(c.company_name LIKE ? OR c.website LIKE ? OR c.category LIKE ? OR d.name LIKE ? OR ci.name LIKE ?)';
    $like = "%$q%";
    array_push($params, $like, $like, $like, $like, $like);
}
if ($category !== '') {
    $where[] = 'c.category = ?';
    $params[] = $category;
}
if ($districtId > 0) {
    $where[] = 'c.district_id = ?';
    $params[] = $districtId;
}
if ($cityId > 0) {
    $where[] = 'c.city_id = ?';
    $params[] = $cityId;
}
$whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

$sql = "SELECT c.id, c.company_name, c.slug, c.website, c.category, c.description, c.is_approved, c.logo,
               (SELECT cc.path FROM company_covers cc WHERE cc.company_id = c.id ORDER BY cc.sort_order, cc.id LIMIT 1) AS cover,
               c.district_id, c.city_id, d.name AS district_name, ci.name AS city_name,
               COALESCE(ROUND(AVG(r.rating), 1), 0) AS avg_rating,
               COUNT(r.id) AS review_count
        FROM companies c
        LEFT JOIN districts d ON d.id = c.district_id
        LEFT JOIN cities    ci ON ci.id = c.city_id
        LEFT JOIN reviews r ON r.company_id = c.id AND r.is_approved = 1
        $whereSql
        GROUP BY c.id
        ORDER BY avg_rating DESC, review_count DESC
        LIMIT $limit";

$stmt = db()->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

foreach ($rows as &$row) {
    $row['id']           = (int) $row['id'];
    $row['avg_rating']   = (float) $row['avg_rating'];
    $row['review_count'] = (int) $row['review_count'];
    $row['is_approved']  = (bool) $row['is_approved'];
    $row['logo_url']     = asset_url($row['logo']);
    $row['cover_url']    = asset_url($row['cover']);
    $row['open_now']     = company_open_status(db(), $row['id'])['open_now'];
    unset($row['logo'], $row['cover']);
}
json_out(['companies' => $rows]);
