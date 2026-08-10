<?php
/**
 * URL helpers for turning stored relative paths (e.g. "uploads/logos/x.jpg")
 * into absolute URLs pointing at the Apache-served backend, regardless of which
 * origin the frontend calls from (dist build or Vite dev server).
 */

/** Absolute base URL of the backend folder, e.g. http://localhost/meetup/backend/ */
function backend_base_url(): string
{
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $script = $_SERVER['SCRIPT_NAME'] ?? '';          // /meetup/backend/api/foo.php
    $base   = preg_replace('#/api/[^/]+$#', '/', $script); // -> /meetup/backend/
    if ($base === null || $base === $script) $base = '/';
    return $scheme . '://' . $host . $base;
}

/** Absolute URL for a stored relative asset path, or null. */
function asset_url(?string $path): ?string
{
    if (!$path) return null;
    // Already absolute? leave it.
    if (preg_match('#^https?://#i', $path)) return $path;
    return backend_base_url() . ltrim($path, '/');
}
