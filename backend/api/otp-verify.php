<?php
/**
 * Verify a submitted OTP against the newest outstanding code for a user.
 * On success the user's mobile is marked verified (is_verified = 1).
 * Body: { user_id, code, purpose? }
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/otp.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$in      = json_in();
$userId  = (int) ($in['user_id'] ?? 0);
$code    = preg_replace('/\D/', '', $in['code'] ?? '');
$purpose = $in['purpose'] ?? 'register';
if (!in_array($purpose, ['register'], true)) $purpose = 'register';

if ($userId <= 0 || $code === '') json_error('Enter the code we sent you.', 400);

$pdo = db();

// Newest un-consumed code for this user + purpose.
$stmt = $pdo->prepare(
    'SELECT id, code, attempts, (expires_at < NOW()) AS expired
       FROM otp_codes
      WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL
      ORDER BY id DESC LIMIT 1'
);
$stmt->execute([$userId, $purpose]);
$otp = $stmt->fetch();

if (!$otp)              json_error('No active code. Please request a new one.', 410);
if ((int) $otp['expired'] === 1) json_error('This code has expired. Please resend.', 410);
if ((int) $otp['attempts'] >= OTP_MAX_ATTEMPTS) {
    $pdo->prepare('UPDATE otp_codes SET consumed_at = NOW() WHERE id = ?')->execute([$otp['id']]);
    json_error('Too many attempts. Please request a new code.', 429);
}

if (!hash_equals($otp['code'], $code)) {
    $pdo->prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?')->execute([$otp['id']]);
    $left = OTP_MAX_ATTEMPTS - ((int) $otp['attempts'] + 1);
    json_error('Incorrect code.' . ($left > 0 ? " $left attempt(s) left." : ''), 422);
}

// Correct — consume the code and flag the user as verified.
$pdo->beginTransaction();
try {
    $pdo->prepare('UPDATE otp_codes SET consumed_at = NOW() WHERE id = ?')->execute([$otp['id']]);
    $pdo->prepare('UPDATE users SET is_verified = 1 WHERE id = ?')->execute([$userId]);
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    json_error('Could not complete verification. Please try again.', 500);
}

// Report the account's post-verification state so the UI can route correctly.
$u = $pdo->prepare('SELECT user_type, status FROM users WHERE id = ?');
$u->execute([$userId]);
$row = $u->fetch();

json_out([
    'verified' => true,
    'role'     => $row['user_type'],
    'status'   => $row['status'], // customers: 'pending' (await admin); companies: gated on company record
]);
