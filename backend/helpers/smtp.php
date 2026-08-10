<?php
/**
 * Minimal SMTP client — enough to relay a single HTML email through a provider
 * such as Gmail or SendGrid, with no external library (no Composer/PHPMailer).
 * Supports STARTTLS (port 587) and implicit SSL (port 465) with AUTH LOGIN.
 *
 * $cfg keys: host, port, user, pass, from_email, from_name, secure ('tls'|'ssl').
 * Returns true on success; on failure returns false and sets $error.
 */
function smtp_send_mail(array $cfg, string $toEmail, string $toName, string $subject, string $htmlBody, ?string &$error = null): bool
{
    $host   = $cfg['host'] ?? '';
    $port   = (int) ($cfg['port'] ?? 587);
    $user   = $cfg['user'] ?? '';
    $pass   = $cfg['pass'] ?? '';
    $secure = $cfg['secure'] ?? 'tls';
    $fromEmail = $cfg['from_email'] ?? $user;
    $fromName  = $cfg['from_name'] ?? '';

    $ctx = stream_context_create(['ssl' => ['verify_peer' => false, 'verify_peer_name' => false]]);
    $remote = ($secure === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
    $fp = @stream_socket_client($remote, $errno, $errstr, 20, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        $error = "SMTP connect failed: $errstr ($errno)";
        return false;
    }
    stream_set_timeout($fp, 20);

    $read = function () use ($fp) {
        $data = '';
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            // Last line of a multi-line reply has a space at position 3.
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        return $data;
    };
    $cmd = function ($c) use ($fp, $read) {
        fwrite($fp, $c . "\r\n");
        return $read();
    };
    $ok = function ($resp, $codes) use (&$error) {
        $code = (int) substr((string) $resp, 0, 3);
        if (!in_array($code, (array) $codes, true)) {
            $error = 'SMTP error: ' . trim((string) $resp);
            return false;
        }
        return true;
    };

    try {
        if (!$ok($read(), 220)) return false;               // server greeting
        if (!$ok($cmd('EHLO meetup.local'), 250)) return false;

        if ($secure === 'tls') {
            if (!$ok($cmd('STARTTLS'), 220)) return false;
            if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                $error = 'SMTP STARTTLS negotiation failed';
                return false;
            }
            if (!$ok($cmd('EHLO meetup.local'), 250)) return false;
        }

        if (!$ok($cmd('AUTH LOGIN'), 334)) return false;
        if (!$ok($cmd(base64_encode($user)), 334)) return false;
        if (!$ok($cmd(base64_encode($pass)), 235)) return false;

        if (!$ok($cmd('MAIL FROM:<' . $fromEmail . '>'), 250)) return false;
        if (!$ok($cmd('RCPT TO:<' . $toEmail . '>'), [250, 251])) return false;
        if (!$ok($cmd('DATA'), 354)) return false;

        $headers = implode("\r\n", [
            'From: ' . mb_encode_header($fromName) . ' <' . $fromEmail . '>',
            'To: ' . mb_encode_header($toName) . ' <' . $toEmail . '>',
            'Subject: ' . mb_encode_header($subject),
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            'Date: ' . date('r'),
        ]);
        // Dot-stuffing: lines starting with '.' must be escaped.
        $body = preg_replace('/^\./m', '..', $htmlBody);
        fwrite($fp, $headers . "\r\n\r\n" . $body . "\r\n.\r\n");
        if (!$ok($read(), 250)) return false;

        $cmd('QUIT');
        return true;
    } finally {
        @fclose($fp);
    }
}

/** RFC 2047 encode a header value so non-ASCII (names, subjects) survive. */
function mb_encode_header(string $text): string
{
    if ($text === '' || preg_match('/^[\x20-\x7E]*$/', $text)) return $text;
    return '=?UTF-8?B?' . base64_encode($text) . '?=';
}
