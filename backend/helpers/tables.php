<?php
/**
 * Shared helpers for bookable tables — used by the company's table manager,
 * the public table picker and the reservation endpoint, so all three agree on
 * what "booked" means.
 */
require_once __DIR__ . '/urls.php';

/**
 * Shape one company_tables row for JSON.
 *
 * `qr_token` is included for the owning company only — it is the secret the
 * printed QR code carries, and the public picker strips it.
 */
function company_table_row(array $r): array
{
    return [
        'id'         => (int) $r['id'],
        'category'   => $r['category'],
        'table_no'   => $r['table_no'],
        'seats'      => (int) $r['seats'],
        'note'       => $r['note'],
        'image_url'  => $r['image'] ? asset_url($r['image']) : null,
        'qr_token'   => $r['qr_token'] ?? null,
        'is_active'  => (int) $r['is_active'] === 1,
        'sort_order' => (int) $r['sort_order'],
    ];
}

/**
 * A fresh, unguessable token for a table's QR code.
 *
 * Looped against the table rather than trusted blindly: the column is unique,
 * and a silent insert failure would leave a table with no printable code.
 */
function new_table_qr_token(PDO $pdo): string
{
    $stmt = $pdo->prepare('SELECT id FROM company_tables WHERE qr_token = ?');
    do {
        $token = bin2hex(random_bytes(16));
        $stmt->execute([$token]);
    } while ($stmt->fetchColumn());
    return $token;
}

/** Every table a company owns, active or not (business dashboard view). */
function company_table_list(PDO $pdo, int $cid): array
{
    $stmt = $pdo->prepare(
        'SELECT id, category, table_no, seats, note, image, qr_token, is_active, sort_order
         FROM company_tables WHERE company_id = ? ORDER BY category, sort_order, id'
    );
    $stmt->execute([$cid]);
    return array_map('company_table_row', $stmt->fetchAll());
}

/** Human label snapshotted onto a reservation, e.g. "VIP · T-12". */
function company_table_label(array $t): string
{
    return $t['category'] . ' · ' . $t['table_no'];
}

/**
 * IDs of this company's tables already taken on $date for the [$from,$to) time
 * range. Two bookings clash when they overlap at all — an existing booking that
 * starts before the new one ends AND ends after the new one starts. Touching
 * ends (10:00–11:00 then 11:00–12:00) do NOT clash.
 *
 * $ignoreId skips one reservation, so a company editing an existing booking
 * isn't reported as clashing with itself.
 */
function booked_table_ids(PDO $pdo, int $cid, string $date, string $from, string $to, ?int $ignoreId = null): array
{
    $sql = 'SELECT DISTINCT table_id FROM reservations
            WHERE company_id = ? AND res_date = ? AND table_id IS NOT NULL
              AND time_from < ? AND time_to > ?';
    $params = [$cid, $date, $to, $from];
    if ($ignoreId !== null) {
        $sql .= ' AND id <> ?';
        $params[] = $ignoreId;
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return array_map('intval', array_column($stmt->fetchAll(), 'table_id'));
}
