<?php
/**
 * Database connection (PDO).
 * Defaults match a standard XAMPP install (user "root", no password).
 */

define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'meetup');
define('DB_USER', 'root');
define('DB_PASS', '');

// Application timezone (Sri Lanka). Keeps PHP date()/date('H:i') and MySQL
// CURDATE()/NOW() on local time so opening-hours "open now" is correct instead
// of being computed in the server's default UTC.
define('APP_TZ', 'Asia/Colombo');
define('APP_TZ_OFFSET', '+05:30'); // MySQL offset (named zones need tz tables)
date_default_timezone_set(APP_TZ);

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
            // Align the MySQL session clock with the app timezone.
            $pdo->exec("SET time_zone = '" . APP_TZ_OFFSET . "'");
        } catch (PDOException $e) {
            die('Database connection failed: ' . htmlspecialchars($e->getMessage())
                . '<br>Make sure MySQL is running in XAMPP and that you imported <code>database.sql</code>.');
        }
    }
    return $pdo;
}
