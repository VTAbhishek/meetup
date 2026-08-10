<?php
require_once __DIR__ . '/_bootstrap.php';

$user = require_api_user();

// GET -> current user
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    json_out(['user' => public_user($user)]);
}

// PUT -> update account settings (name / email / optional password)
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $in       = json_in();
    $fullName = trim($in['full_name'] ?? $user['full_name']);
    $email    = trim($in['email'] ?? $user['email']);
    $password = $in['password'] ?? '';

    $errors = [];
    if ($fullName === '') $errors['full_name'] = 'Full name is required.';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'A valid email is required.';
    if ($password !== '' && strlen($password) < 6) $errors['password'] = 'Password must be at least 6 characters.';

    if (!$errors) {
        $dup = db()->prepare('SELECT id FROM users WHERE email = ? AND id <> ?');
        $dup->execute([$email, $user['id']]);
        if ($dup->fetch()) $errors['email'] = 'That email is already in use.';
    }
    if ($errors) json_out(['errors' => $errors], 422);

    if ($password !== '') {
        db()->prepare('UPDATE users SET full_name = ?, email = ?, password = ? WHERE id = ?')
            ->execute([$fullName, $email, password_hash($password, PASSWORD_DEFAULT), $user['id']]);
    } else {
        db()->prepare('UPDATE users SET full_name = ?, email = ? WHERE id = ?')
            ->execute([$fullName, $email, $user['id']]);
    }
    $fresh = db()->query("SELECT * FROM users WHERE id = " . (int) $user['id'])->fetch();
    json_out(['user' => public_user($fresh)]);
}

json_error('Method not allowed', 405);
