<?php
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/otp.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$in       = json_in();
$role     = in_array($in['role'] ?? 'customer', ['customer', 'company'], true) ? $in['role'] : 'customer';
$fullName = trim($in['full_name'] ?? '');
$username = trim($in['username'] ?? '');
$email    = trim($in['email'] ?? '');
$password = $in['password'] ?? '';
$dialCode = trim($in['dial_code'] ?? '+94');
$mobile   = preg_replace('/\D/', '', $in['mobile'] ?? ''); // keep digits only
$company    = trim($in['company_name'] ?? '');
$website     = trim($in['website'] ?? '');
$category    = trim($in['category'] ?? '');
$phone       = trim($in['phone'] ?? '');
$address     = trim($in['address'] ?? '');
$districtId  = (int) ($in['district_id'] ?? 0);
$cityId      = (int) ($in['city_id'] ?? 0);

$errors = [];
if ($fullName === '') $errors['full_name'] = 'Full name is required.';
if (!preg_match('/^[A-Za-z0-9_]{3,30}$/', $username))
    $errors['username'] = 'Username must be 3-30 characters (letters, numbers, underscore).';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'A valid email is required.';
if (strlen($password) < 6) $errors['password'] = 'Password must be at least 6 characters.';

// Country dial code + a strictly 10-digit mobile number are compulsory.
if (!preg_match('/^\+\d{1,4}$/', $dialCode)) $errors['dial_code'] = 'Choose a valid country code.';
if ($mobile === '')            $errors['mobile'] = 'Mobile number is required.';
elseif (!preg_match('/^\d{10}$/', $mobile)) $errors['mobile'] = 'Mobile number must be exactly 10 digits.';

if ($role === 'company') {
    if ($company === '')     $errors['company_name'] = 'Company name is required.';
    if ($districtId <= 0)    $errors['district_id']  = 'Please select a district.';
    if ($cityId <= 0)        $errors['city_id']      = 'Please select a city.';

    // The category is what puts a company on the Browse-by-category pages and
    // in the category filter. Left blank it is invisible there, so it is
    // required — and checked against the managed list, since a free-typed
    // value would match no category page at all.
    if ($category === '') {
        $errors['category'] = 'Please choose a category.';
    } else {
        $ck = db()->prepare('SELECT id FROM categories WHERE name = ?');
        $ck->execute([$category]);
        if (!$ck->fetch()) $errors['category'] = 'Please choose a category from the list.';
    }

    // The chosen city must actually belong to the chosen district. Checked
    // whenever both were supplied, rather than only when nothing else failed —
    // otherwise a blank category would hide this error until the next attempt.
    if ($districtId > 0 && $cityId > 0) {
        $ck = db()->prepare('SELECT id FROM cities WHERE id = ? AND district_id = ?');
        $ck->execute([$cityId, $districtId]);
        if (!$ck->fetch()) $errors['city_id'] = 'That city does not belong to the selected district.';
    }
}

if (!$errors) {
    $stmt = db()->prepare('SELECT username, email, mobile FROM users WHERE username = ? OR email = ? OR mobile = ?');
    $stmt->execute([$username, $email, $mobile]);
    while ($row = $stmt->fetch()) {
        if ($row['username'] === $username)      $errors['username'] = 'That username is already taken.';
        elseif ($row['email'] === $email)        $errors['email']    = 'That email is already registered.';
        elseif ($row['mobile'] === $mobile)      $errors['mobile']   = 'That mobile number is already registered.';
    }
}

if ($errors) json_out(['errors' => $errors], 422);

$pdo = db();
$pdo->beginTransaction();
try {
    // New accounts start as pending admin approval. For companies the gate
    // lives on the company record, so the owner user itself stays active.
    // is_verified stays 0 until the mobile OTP is confirmed.
    $userStatus = $role === 'company' ? 'active' : 'pending';
    $pdo->prepare(
        'INSERT INTO users (user_type, full_name, username, email, dial_code, mobile, password, is_verified, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)'
    )->execute([$role, $fullName, $username, $email, $dialCode, $mobile, password_hash($password, PASSWORD_DEFAULT), $userStatus]);
    $userId = (int) $pdo->lastInsertId();

    if ($role === 'company') {
        // unique slug
        $base = strtolower(preg_replace('/[^a-z0-9]+/', '-', strtolower($company)));
        $base = trim($base, '-') ?: ('company-' . $userId);
        $slug = $base;
        $check = $pdo->prepare('SELECT id FROM companies WHERE slug = ?');
        $check->execute([$slug]);
        if ($check->fetch()) $slug = $base . '-' . $userId;

        $pdo->prepare(
            "INSERT INTO companies (user_id, company_name, slug, website, category, district_id, city_id, phone, address, is_approved, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending')"
        )->execute([$userId, $company, $slug, $website ?: null, $category ?: null, $districtId, $cityId, $phone ?: ($dialCode . $mobile), $address ?: null]);
    }

    // Generate + send the first OTP inside the same transaction.
    $code = otp_issue($pdo, $userId, $mobile, $dialCode, 'register');

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    json_error('Something went wrong. Please try again.', 500);
}

$resp = [
    'otp_required' => true,
    'role'         => $role,
    'user_id'      => $userId,
    'dial_code'    => $dialCode,
    'mobile_masked'=> otp_mask_mobile($mobile),
    'resend_in'    => OTP_RESEND_COOLDOWN,
    'expires_in'   => OTP_TTL_SECONDS,
];
// In simulate mode expose the code so the dev UI can display it.
if (OTP_SIMULATE) $resp['otp_debug'] = $code;

json_out($resp, 201);
