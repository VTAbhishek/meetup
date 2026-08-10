<?php
/** Cover-gallery helpers (the `company_covers` table). */
require_once __DIR__ . '/urls.php';

function company_cover_rows(PDO $pdo, int $companyId): array
{
    $stmt = $pdo->prepare('SELECT id, path FROM company_covers WHERE company_id = ? ORDER BY sort_order, id');
    $stmt->execute([$companyId]);
    return $stmt->fetchAll();
}

/** [{ id, url }] — for the owner's management UI. */
function company_cover_list(PDO $pdo, int $companyId): array
{
    return array_map(
        fn ($r) => ['id' => (int) $r['id'], 'url' => asset_url($r['path'])],
        company_cover_rows($pdo, $companyId)
    );
}

/** [url, url, …] — for public display (the slideshow). */
function company_cover_urls(PDO $pdo, int $companyId): array
{
    return array_map(fn ($r) => asset_url($r['path']), company_cover_rows($pdo, $companyId));
}
