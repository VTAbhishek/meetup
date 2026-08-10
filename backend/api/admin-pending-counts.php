<?php
require_once __DIR__ . '/_bootstrap.php';

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

json_out([
    'companies' => (int) db()->query("SELECT COUNT(*) FROM companies WHERE status = 'pending'")->fetchColumn(),
    'customers' => (int) db()->query("SELECT COUNT(*) FROM users WHERE user_type = 'customer' AND status = 'pending'")->fetchColumn(),
]);
