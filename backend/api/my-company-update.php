<?php
require_once __DIR__ . '/_bootstrap.php';

if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT'], true)) json_error('Method not allowed', 405);

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$stmt = db()->prepare('SELECT id FROM companies WHERE user_id = ?');
$stmt->execute([$user['id']]);
$company = $stmt->fetch();
if (!$company) json_error('No company profile found', 404);

$in          = json_in();
$name        = trim($in['company_name'] ?? '');
$website     = trim($in['website'] ?? '');
$category    = trim($in['category'] ?? '');
$phone       = trim($in['phone'] ?? '');
$address     = trim($in['address'] ?? '');
$description = trim($in['description'] ?? '');

if ($name === '') json_error('Company name is required.', 422);

// Map pin. Sent as numbers by the picker, or explicitly null to clear the pin.
// Only touch the columns when the client actually included the keys, so the
// plain "edit profile" form can't wipe a pin it never showed.
$mapFields = [];
$mapParams = [];
if (array_key_exists('latitude', $in) && array_key_exists('longitude', $in)) {
    $lat = $in['latitude'];
    $lng = $in['longitude'];
    if ($lat === null || $lng === null || $lat === '' || $lng === '') {
        $mapFields = ['latitude = ?', 'longitude = ?'];
        $mapParams = [null, null];
    } else {
        $lat = (float) $lat;
        $lng = (float) $lng;
        if ($lat < -90 || $lat > 90)   json_error('Latitude must be between -90 and 90.', 422);
        if ($lng < -180 || $lng > 180) json_error('Longitude must be between -180 and 180.', 422);
        $mapFields = ['latitude = ?', 'longitude = ?'];
        $mapParams = [$lat, $lng];

        if (array_key_exists('map_zoom', $in)) {
            $zoom = (int) $in['map_zoom'];
            $mapFields[] = 'map_zoom = ?';
            $mapParams[] = max(1, min(21, $zoom));
        }
    }
}

$sql = 'UPDATE companies SET company_name = ?, website = ?, category = ?, phone = ?, address = ?, description = ?';
if ($mapFields) $sql .= ', ' . implode(', ', $mapFields);
$sql .= ' WHERE id = ?';

db()->prepare($sql)->execute([
    $name,
    $website ?: null,
    $category ?: null,
    $phone ?: null,
    $address ?: null,
    $description ?: null,
    ...$mapParams,
    $company['id'],
]);

json_out(['ok' => true]);
