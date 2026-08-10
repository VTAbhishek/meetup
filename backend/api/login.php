<?php
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$in       = json_in();
$username = trim($in['username'] ?? '');
$password = $in['password'] ?? '';
$role     = in_array($in['role'] ?? 'customer', ['customer', 'company', 'admin'], true)
          ? $in['role'] : 'customer';

// Authenticate by username OR email within the requested role.
$stmt = db()->prepare(
    'SELECT * FROM users WHERE (username = ? OR email = ?) AND user_type = ?'
);
$stmt->execute([$username, $username, $role]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password'])) {
    json_error('Invalid username or password.', 401);
}

// Status gating: companies are gated on the company record, everyone else on
// their user account. Only "active" accounts may sign in.
if ($role === 'company') {
    $cs = db()->prepare('SELECT status FROM companies WHERE user_id = ?');
    $cs->execute([$user['id']]);
    $status = $cs->fetchColumn() ?: 'pending';
    if ($status === 'pending') json_error('Your company is pending admin approval.', 403);
    if ($status !== 'active')   json_error('Your company account has been deactivated.', 403);
} elseif ($role !== 'admin') {
    if ($user['status'] === 'pending') json_error('Your account is pending admin approval.', 403);
    if ($user['status'] !== 'active')  json_error('Your account has been deactivated.', 403);
}

json_out(['token' => issue_token((int) $user['id']), 'user' => public_user($user)]);
