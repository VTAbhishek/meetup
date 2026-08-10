<?php
/**
 * Mail delivery settings — EXAMPLE.
 *
 * Copy this file to `mail.php` and fill in your own SMTP credentials.
 * `mail.php` is git-ignored so real credentials never reach the repository.
 *
 * Set 'enabled' to true and fill the SMTP fields to send real emails. With
 * Gmail you MUST use an App Password (Google Account → Security → 2-Step
 * Verification → App passwords), not your normal account password.
 *
 * While 'enabled' is false (or credentials are blank) emails are simulated:
 * they are written to backend/storage/mail.log instead of being delivered.
 */

return [
    'enabled'    => false,               // flip to true once SMTP_* are filled
    'host'       => 'smtp.gmail.com',
    'port'       => 587,                 // 587 = STARTTLS, 465 = SSL
    'secure'     => 'tls',               // 'tls' for 587, 'ssl' for 465
    'user'       => '',                  // your full Gmail address
    'pass'       => '',                  // 16-char Gmail App Password
    'from_email' => '',                  // usually same as user; blank -> user
    'from_name'  => 'Meetup',
];
