<?php
/**
 * Email helpers.
 *
 * Dev/simulate mode (MAIL_SIMULATE = true): messages are NOT delivered over a
 * real transport. They are appended to backend/storage/mail.log so the flow is
 * testable without an SMTP server. Flip MAIL_SIMULATE to false and wire a real
 * transport (PHP mail(), PHPMailer/SMTP, a mail API, …) in send_email() to go
 * live. Mirrors the OTP simulate convention in helpers/otp.php.
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/smtp.php';

const SITE_NAME = 'Meetup';

/** Load mail settings (config/mail.php). */
function mail_config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $cfg = @include __DIR__ . '/../config/mail.php';
        if (!is_array($cfg)) $cfg = [];
    }
    return $cfg;
}

/** Append a message to the simulate log (also used as a fallback record). */
function mail_log(string $toEmail, string $toName, string $subject, string $htmlBody, string $note = ''): void
{
    $line = sprintf(
        "[%s]%s to=%s <%s>\nsubject=%s\n%s\n%s\n%s\n\n",
        date('Y-m-d H:i:s'),
        $note !== '' ? " ($note)" : '',
        $toName,
        $toEmail,
        $subject,
        str_repeat('=', 70),
        $htmlBody,
        str_repeat('=', 70)
    );
    @file_put_contents(__DIR__ . '/../storage/mail.log', $line, FILE_APPEND);
}

/**
 * Send an HTML email. Delivers over SMTP when config/mail.php is enabled and
 * has credentials; otherwise (or if the send fails) it logs to storage/mail.log
 * so the flow still works in dev. Returns true when the message was delivered
 * or logged.
 */
function send_email(string $toEmail, string $toName, string $subject, string $htmlBody): bool
{
    if ($toEmail === '' || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) return false;

    $cfg = mail_config();
    $live = !empty($cfg['enabled']) && !empty($cfg['user']) && !empty($cfg['pass']);

    if ($live) {
        $error = null;
        $ok = smtp_send_mail([
            'host'       => $cfg['host'] ?? 'smtp.gmail.com',
            'port'       => $cfg['port'] ?? 587,
            'secure'     => $cfg['secure'] ?? 'tls',
            'user'       => $cfg['user'],
            'pass'       => $cfg['pass'],
            'from_email' => $cfg['from_email'] ?: $cfg['user'],
            'from_name'  => $cfg['from_name'] ?? SITE_NAME,
        ], $toEmail, $toName, $subject, $htmlBody, $error);

        // Always keep a copy in the log; note failures for debugging.
        mail_log($toEmail, $toName, $subject, $htmlBody, $ok ? 'SENT via SMTP' : ('SMTP FAILED: ' . $error));
        return $ok;
    }

    mail_log($toEmail, $toName, $subject, $htmlBody, 'SIMULATED');
    return true;
}

/**
 * Branded reservation-confirmation receipt (inline-styled HTML, email-safe).
 * $company: company_name, category, phone, website, address (any may be null).
 * $res:     name, mobile, res_date, time_from, time_to, person_count,
 *           description, reply (any may be null).
 */
function reservation_receipt_html(array $company, array $res): string
{
    $e = fn ($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES, 'UTF-8');

    $site    = SITE_NAME;
    $coName  = $e($company['company_name'] ?? 'The company');
    $when    = date('l, F j, Y', strtotime($res['res_date']));
    $time    = substr($res['time_from'], 0, 5) . ' – ' . substr($res['time_to'], 0, 5);
    $persons = (int) ($res['person_count'] ?? 1);

    // Company detail lines (only the ones that exist).
    $coRows = '';
    foreach ([
        'Category' => $company['category'] ?? null,
        'Phone'    => $company['phone'] ?? null,
        'Website'  => $company['website'] ?? null,
        'Address'  => $company['address'] ?? null,
    ] as $label => $val) {
        if ($val) {
            $coRows .= '<tr><td style="padding:2px 12px 2px 0;color:#64748b;font-size:13px;">' . $label . '</td>'
                     . '<td style="padding:2px 0;color:#0f172a;font-size:13px;font-weight:600;">' . $e($val) . '</td></tr>';
        }
    }

    $row = fn ($label, $val) =>
        '<tr><td style="padding:8px 0;border-bottom:1px solid #eef2f7;color:#64748b;font-size:14px;">' . $label . '</td>'
        . '<td style="padding:8px 0;border-bottom:1px solid #eef2f7;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">' . $val . '</td></tr>';

    $replyBlock = '';
    if (!empty($res['reply'])) {
        $replyBlock = '<div style="margin-top:16px;padding:12px 14px;background:#f8fafc;border-left:3px solid #16a34a;border-radius:8px;">'
            . '<div style="font-size:12px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.04em;">Message from ' . $coName . '</div>'
            . '<div style="margin-top:4px;color:#334155;font-size:14px;">' . $e($res['reply']) . '</div></div>';
    }

    $descRow = !empty($res['description']) ? $row('Notes', $e($res['description'])) : '';

    return '
<div style="background:#f1f5f9;padding:24px 0;font-family:Segoe UI,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(120deg,#3f5bff,#7c3aed);padding:22px 28px;">
      <div style="color:#ffffff;font-size:20px;font-weight:800;">' . $site . '</div>
      <div style="color:#e0e7ff;font-size:13px;margin-top:2px;">Reservation receipt</div>
    </div>

    <div style="padding:26px 28px;">
      <div style="display:inline-block;background:#dcfce7;color:#15803d;font-size:13px;font-weight:700;padding:5px 12px;border-radius:999px;">✓ Reservation confirmed</div>
      <h2 style="margin:14px 0 4px;color:#0f172a;font-size:20px;">Booking with ' . $coName . '</h2>
      <p style="margin:0;color:#64748b;font-size:14px;">Your reservation has been confirmed. Here are the details:</p>

      <table style="width:100%;border-collapse:collapse;margin-top:18px;">
        ' . $row('Name', $e($res['name'])) . '
        ' . $row('Mobile', $e($res['mobile'])) . '
        ' . $row('Date', $when) . '
        ' . $row('Time', $time) . '
        ' . $row('Members', $persons) . '
        ' . $descRow . '
      </table>

      ' . $replyBlock . '

      <div style="margin-top:22px;padding-top:16px;border-top:1px solid #eef2f7;">
        <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">Company details</div>
        <div style="margin-top:6px;color:#0f172a;font-size:15px;font-weight:700;">' . $coName . '</div>
        <table style="margin-top:6px;">' . $coRows . '</table>
      </div>
    </div>

    <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #eef2f7;color:#94a3b8;font-size:12px;text-align:center;">
      This receipt was sent by ' . $site . '. Please keep it for your records.
    </div>
  </div>
</div>';
}
