<?php
/**
 * OTP helpers — generation, storage, "sending", and cooldown logic.
 *
 * Dev/simulate mode (OTP_SIMULATE = true): the code is NOT sent over a real SMS
 * gateway. Instead it is written to backend/storage/otp.log and returned to the
 * client in the API response (field `otp_debug`) so the flow can be tested end
 * to end without paying for SMS. Flip OTP_SIMULATE to false and implement
 * otp_send_sms() to go live.
 */

require_once __DIR__ . '/../config/db.php';

const OTP_LENGTH           = 6;    // digits
const OTP_TTL_SECONDS      = 300;  // a code is valid for 5 minutes
const OTP_RESEND_COOLDOWN  = 30;   // seconds a user must wait before a resend
const OTP_MAX_ATTEMPTS     = 5;    // wrong tries before a code is burned
const OTP_SIMULATE         = true; // dev mode: log + return code instead of SMS

/** Generate a zero-padded numeric OTP, e.g. "042317". */
function otp_generate(): string
{
    $max = (10 ** OTP_LENGTH) - 1;
    return str_pad((string) random_int(0, $max), OTP_LENGTH, '0', STR_PAD_LEFT);
}

/**
 * "Send" the OTP. In simulate mode this appends to storage/otp.log. Replace the
 * body of the live branch with a call to your SMS provider (Twilio, Notify.lk,
 * Dialog, etc.). Returns true on success.
 */
function otp_send_sms(string $dialCode, string $mobile, string $code): bool
{
    $to = $dialCode . $mobile;

    if (OTP_SIMULATE) {
        $line = sprintf("[%s] to=%s code=%s\n", date('Y-m-d H:i:s'), $to, $code);
        @file_put_contents(__DIR__ . '/../storage/otp.log', $line, FILE_APPEND);
        return true;
    }

    // ---- LIVE SMS GATEWAY GOES HERE ----------------------------------------
    // Example (pseudo):
    //   $ok = my_sms_provider_send($to, "Your Meetup code is $code");
    //   return (bool) $ok;
    // ------------------------------------------------------------------------
    return false;
}

/** Seconds elapsed since the user's most recent code for a purpose, or null. */
function otp_seconds_since_last(PDO $pdo, int $userId, string $purpose): ?int
{
    $stmt = $pdo->prepare(
        'SELECT TIMESTAMPDIFF(SECOND, created_at, NOW())
           FROM otp_codes
          WHERE user_id = ? AND purpose = ?
          ORDER BY id DESC LIMIT 1'
    );
    $stmt->execute([$userId, $purpose]);
    $val = $stmt->fetchColumn();
    return $val === false ? null : (int) $val;
}

/**
 * Generate, persist and send a fresh OTP for a user. Any earlier un-consumed
 * codes for the same purpose are invalidated so only the newest one works.
 * Returns the plain code (needed so callers can echo it in simulate mode).
 */
function otp_issue(PDO $pdo, int $userId, string $mobile, string $dialCode, string $purpose = 'register'): string
{
    // Burn previous outstanding codes for this purpose.
    $pdo->prepare(
        'UPDATE otp_codes SET consumed_at = NOW()
          WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL'
    )->execute([$userId, $purpose]);

    $code = otp_generate();
    $pdo->prepare(
        'INSERT INTO otp_codes (user_id, mobile, purpose, code, expires_at)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))'
    )->execute([$userId, $mobile, $purpose, $code, OTP_TTL_SECONDS]);

    otp_send_sms($dialCode, $mobile, $code);
    return $code;
}

/** Mask a mobile for display: 0771234567 -> ******4567. */
function otp_mask_mobile(string $mobile): string
{
    $len = strlen($mobile);
    if ($len <= 4) return $mobile;
    return str_repeat('*', $len - 4) . substr($mobile, -4);
}
