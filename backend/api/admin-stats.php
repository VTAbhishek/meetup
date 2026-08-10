<?php
require_once __DIR__ . '/_bootstrap.php';

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

$counts = [
    'customers' => (int) db()->query("SELECT COUNT(*) FROM users WHERE user_type='customer'")->fetchColumn(),
    'companies' => (int) db()->query("SELECT COUNT(*) FROM users WHERE user_type='company'")->fetchColumn(),
    'reviews'   => (int) db()->query("SELECT COUNT(*) FROM reviews")->fetchColumn(),
    'profiles'  => (int) db()->query("SELECT COUNT(*) FROM companies")->fetchColumn(),
];

$customers = db()->query(
    "SELECT id, full_name, username, email, status, created_at
     FROM users WHERE user_type='customer' ORDER BY created_at DESC LIMIT 50"
)->fetchAll();

$companies = db()->query(
    "SELECT u.id, u.full_name, u.username, u.email, u.status, u.created_at,
            c.company_name
     FROM users u
     LEFT JOIN companies c ON c.user_id = u.id
     WHERE u.user_type='company' ORDER BY u.created_at DESC LIMIT 50"
)->fetchAll();

$recent = db()->query(
    "SELECT r.id, r.rating, r.title, r.body, r.created_at,
            u.full_name AS customer_name, c.company_name, c.slug
     FROM reviews r
     JOIN users u ON u.id = r.customer_id
     JOIN companies c ON c.id = r.company_id
     ORDER BY r.created_at DESC LIMIT 10"
)->fetchAll();

json_out([
    'counts'        => $counts,
    'customers'     => $customers,
    'companies'     => $companies,
    'recentReviews' => $recent,
]);
