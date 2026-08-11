<?php
/**
 * Shared helpers for mood tags, so the public list, the company editor and the
 * company/profile endpoints all shape moods the same way.
 */

/** The whole mood vocabulary, in display order. */
function mood_catalogue(PDO $pdo): array
{
    $rows = $pdo->query('SELECT id, slug, name, hint, icon FROM moods ORDER BY sort_order, id')->fetchAll();
    return array_map(fn ($r) => [
        'id'   => (int) $r['id'],
        'slug' => $r['slug'],
        'name' => $r['name'],
        'hint' => $r['hint'],
        'icon' => $r['icon'],
    ], $rows);
}

/** The moods one company has ticked, in display order. */
function company_moods(PDO $pdo, int $cid): array
{
    $stmt = $pdo->prepare(
        'SELECT m.id, m.slug, m.name, m.hint, m.icon
         FROM company_moods cm
         JOIN moods m ON m.id = cm.mood_id
         WHERE cm.company_id = ?
         ORDER BY m.sort_order, m.id'
    );
    $stmt->execute([$cid]);
    return array_map(fn ($r) => [
        'id'   => (int) $r['id'],
        'slug' => $r['slug'],
        'name' => $r['name'],
        'hint' => $r['hint'],
        'icon' => $r['icon'],
    ], $stmt->fetchAll());
}

/**
 * Replace a company's moods with exactly $moodIds.
 *
 * Ids are filtered against the moods table first, so a bad id is dropped rather
 * than raising a foreign-key error.
 */
function set_company_moods(PDO $pdo, int $cid, array $moodIds): void
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $moodIds), fn ($i) => $i > 0)));

    $valid = [];
    if ($ids) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare("SELECT id FROM moods WHERE id IN ($ph)");
        $stmt->execute($ids);
        $valid = array_map('intval', array_column($stmt->fetchAll(), 'id'));
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM company_moods WHERE company_id = ?')->execute([$cid]);
        if ($valid) {
            $ins = $pdo->prepare('INSERT INTO company_moods (company_id, mood_id) VALUES (?, ?)');
            foreach ($valid as $mid) $ins->execute([$cid, $mid]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}
