<?php
/**
 * Admin: manage the mood vocabulary companies tick and customers filter by.
 *   GET          -> list moods with how many companies claim each
 *   POST         { name, hint, icon, sort_order } -> add a mood
 *   PUT    ?id=  { name, hint, icon, sort_order } -> edit a mood
 *   DELETE ?id=  -> remove a mood (company ticks cascade away)
 *
 * The slug is derived from the name rather than typed: it is only a stable key
 * for URLs, and letting it be edited would break links customers have shared.
 */
require_once __DIR__ . '/_bootstrap.php';

$user = require_api_user();
if ($user['user_type'] !== 'admin') json_error('Forbidden', 403);

$method = $_SERVER['REQUEST_METHOD'];

/**
 * "Late night spot" -> "late-night-spot", made unique against the table.
 * $ignoreId lets a rename keep its own slug instead of colliding with itself.
 */
function mood_slug(PDO $pdo, string $name, int $ignoreId = 0): string
{
    $base = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', $name), '-'));
    if ($base === '') $base = 'mood';
    $base = substr($base, 0, 55);

    $stmt = $pdo->prepare('SELECT id FROM moods WHERE slug = ? AND id <> ?');
    $slug = $base;
    for ($n = 2; ; $n++) {
        $stmt->execute([$slug, $ignoreId]);
        if (!$stmt->fetch()) return $slug;
        $slug = $base . '-' . $n;
    }
}

/** Pull name/hint/icon/sort_order out of a request body, validated. */
function mood_input(array $in): array
{
    $name = trim($in['name'] ?? '');
    $hint = trim($in['hint'] ?? '');
    $icon = trim($in['icon'] ?? '');

    if ($name === '')           json_error('Mood name is required.', 422);
    if (mb_strlen($name) > 80)  json_error('Mood name is too long (max 80 characters).', 422);
    if (mb_strlen($hint) > 160) json_error('The hint is too long (max 160 characters).', 422);
    if (mb_strlen($icon) > 40)  json_error('Icon name is too long.', 422);

    return [
        'name'       => $name,
        'hint'       => $hint === '' ? null : $hint,
        'icon'       => $icon === '' ? null : $icon,
        'sort_order' => (int) ($in['sort_order'] ?? 0),
    ];
}

/** Reject a name already used by another mood — two identical chips help nobody. */
function assert_mood_name_free(PDO $pdo, string $name, int $ignoreId = 0): void
{
    $stmt = $pdo->prepare('SELECT id FROM moods WHERE name = ? AND id <> ?');
    $stmt->execute([$name, $ignoreId]);
    if ($stmt->fetch()) json_error('A mood with that name already exists.', 409);
}

// ---- list ----
if ($method === 'GET') {
    $rows = db()->query(
        'SELECT m.id, m.slug, m.name, m.hint, m.icon, m.sort_order,
                (SELECT COUNT(*) FROM company_moods cm WHERE cm.mood_id = m.id) AS company_count
           FROM moods m
          ORDER BY m.sort_order, m.id'
    )->fetchAll();

    foreach ($rows as &$r) {
        $r['id']            = (int) $r['id'];
        $r['sort_order']    = (int) $r['sort_order'];
        $r['company_count'] = (int) $r['company_count'];
    }
    json_out(['moods' => $rows]);
}

// ---- create ----
if ($method === 'POST') {
    $data = mood_input(json_in());
    assert_mood_name_free(db(), $data['name']);

    // Default a new mood to the end of the list when no order was given.
    if ($data['sort_order'] === 0) {
        $data['sort_order'] = 1 + (int) db()->query('SELECT COALESCE(MAX(sort_order), 0) FROM moods')->fetchColumn();
    }

    $slug = mood_slug(db(), $data['name']);
    db()->prepare('INSERT INTO moods (slug, name, hint, icon, sort_order) VALUES (?, ?, ?, ?, ?)')
        ->execute([$slug, $data['name'], $data['hint'], $data['icon'], $data['sort_order']]);

    json_out(['id' => (int) db()->lastInsertId(), 'slug' => $slug] + $data, 201);
}

// ---- update ----
if ($method === 'PUT') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) json_error('Which mood?', 422);

    $stmt = db()->prepare('SELECT id, slug, name FROM moods WHERE id = ?');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) json_error('That mood no longer exists.', 404);

    $data = mood_input(json_in());
    assert_mood_name_free(db(), $data['name'], $id);

    // Only re-slug on a real rename, so shared links survive a hint or icon edit.
    $slug = $data['name'] === $existing['name']
        ? $existing['slug']
        : mood_slug(db(), $data['name'], $id);

    db()->prepare('UPDATE moods SET slug = ?, name = ?, hint = ?, icon = ?, sort_order = ? WHERE id = ?')
        ->execute([$slug, $data['name'], $data['hint'], $data['icon'], $data['sort_order'], $id]);

    json_out(['id' => $id, 'slug' => $slug] + $data);
}

// ---- delete ----
if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) json_error('Which mood?', 422);

    // company_moods has ON DELETE CASCADE, so the ticks go with it.
    db()->prepare('DELETE FROM moods WHERE id = ?')->execute([$id]);
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
