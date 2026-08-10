<?php
/**
 * Resend an OTP. Enforces a per-user cooldown (OTP_RESEND_COOLDOWN seconds) so
 * the "Resend" button on the client can only fire once the 30s timer hits zero.
 * Body: { user_id, purpose? }
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/otp.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$in      = json_in();
$userId  = (int) ($in['user_id'] ?? 0);
$purpose = $in['purpose'] ?? 'register';
if (!in_array($purpose, ['register'], true)) $purpose = 'register';

if ($userId <= 0) json_error('Invalid request.', 400);

$pdo  = db();
$stmt = $pdo->prepare('SELECT id, dial_code, mobile, is_verified FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user)                json_error('Account not found.', 404);
if ((int) $user['is_verified'] === 1) json_error('This number is already verified.', 409);
if (empty($user['mobile'])) json_error('No mobile number on file.', 400);

// Cooldown gate: block a resend that comes in before the timer elapses.
$since = otp_seconds_since_last($pdo, $userId, $purpose);
if ($since !== null && $since < OTP_RESEND_COOLDOWN) {
    json_out(['error' => 'Please wait before requesting another code.',
              'retry_after' => OTP_RESEND_COOLDOWN - $since], 429);
}

$code = otp_issue($pdo, $userId, $user['mobile'], $user['dial_code'] ?: '+94', $purpose);

$resp = [
    'resent'     => true,
    'resend_in'  => OTP_RESEND_COOLDOWN,
    'expires_in' => OTP_TTL_SECONDS,
];
if (OTP_SIMULATE) $resp['otp_debug'] = $code;

json_out($resp);
