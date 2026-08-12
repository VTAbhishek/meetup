<?php
/**
 * Shared bootstrap for all JSON API endpoints.
 * - CORS for the Vite dev server (and same-origin production build)
 * - JSON input/output helpers
 * - Bearer-token authentication backed by the `auth_tokens` table
 */
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../helpers/urls.php';

// ---- CORS ----
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-HTTP-Method-Override');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---- Method override ----
// The client sends PUT and DELETE as POST with the real verb in this header,
// because many shared hosts refuse those verbs outright. Restore it here, once,
// so every endpoint below can keep branching on REQUEST_METHOD as normal.
// Only POST is allowed to be overridden, and only to PUT or DELETE — otherwise
// the header would be a way to turn a harmless GET into a delete.
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $headers   = function_exists('getallheaders') ? getallheaders() : [];
    $override  = $headers['X-HTTP-Method-Override']
        ?? $headers['x-http-method-override']
        ?? ($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? '');
    $override  = strtoupper(trim($override));
    if ($override === 'PUT' || $override === 'DELETE') {
        $_SERVER['REQUEST_METHOD'] = $override;
    }
}

/** Send a JSON response and stop. */
function json_out($data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function json_error(string $message, int $code = 400): void
{
    json_out(['error' => $message], $code);
}

/** Parse the JSON request body into an array. */
function json_in(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Read the bearer token from the Authorization header. */
function bearer_token(): ?string
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/Bearer\s+(\S+)/i', $auth, $m)) {
        return $m[1];
    }
    return null;
}

/** Return the authenticated user row, or null. */
function api_user(): ?array
{
    $token = bearer_token();
    if (!$token) return null;
    $stmt = db()->prepare(
        'SELECT u.* FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?'
    );
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    return $user ?: null;
}

/** Require an authenticated user (any type) or 401. */
function require_api_user(): array
{
    $user = api_user();
    if (!$user) json_error('Not authenticated', 401);
    if ($user['status'] !== 'active') json_error('Account is inactive', 403);
    return $user;
}

/** Create and persist a new auth token for a user. */
function issue_token(int $userId): string
{
    $token = bin2hex(random_bytes(32));
    db()->prepare('INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)')->execute([$token, $userId]);
    return $token;
}

/** Shape a user row for the client (no secrets). */
function public_user(array $u): array
{
    return [
        'id'         => (int) $u['id'],
        'full_name'  => $u['full_name'],
        'username'   => $u['username'],
        'email'      => $u['email'],
        'user_type'  => $u['user_type'],
        'avatar_url' => asset_url($u['avatar'] ?? null),
    ];
}
