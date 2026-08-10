<?php
require_once __DIR__ . '/_bootstrap.php';

$token = bearer_token();
if ($token) {
    db()->prepare('DELETE FROM auth_tokens WHERE token = ?')->execute([$token]);
}
json_out(['ok' => true]);
