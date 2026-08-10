<?php
/**
 * Opening-hours helpers.
 *
 * Weekly schedule lives in `company_hours` (one row per weekday, 0=Sun…6=Sat).
 * `company_hour_overrides` holds per-DATE exceptions — the dashboard writes one
 * for *today* ("special hours" or "closed today"); any other date keeps using
 * the weekly schedule automatically because lookups are by CURDATE().
 */

/** Weekly rows keyed by weekday. */
function company_weekly_hours(PDO $pdo, int $companyId): array
{
    $stmt = $pdo->prepare(
        'SELECT weekday, is_open, open_time, close_time FROM company_hours WHERE company_id = ? ORDER BY weekday'
    );
    $stmt->execute([$companyId]);
    $out = [];
    foreach ($stmt->fetchAll() as $r) {
        $out[(int) $r['weekday']] = [
            'weekday'    => (int) $r['weekday'],
            'is_open'    => (bool) $r['is_open'],
            'open_time'  => $r['open_time'] ? substr($r['open_time'], 0, 5) : null,
            'close_time' => $r['close_time'] ? substr($r['close_time'], 0, 5) : null,
        ];
    }
    return $out;
}

/** Today's override row (formatted) or null. */
function company_today_override(PDO $pdo, int $companyId): ?array
{
    $stmt = $pdo->prepare(
        'SELECT is_open, open_time, close_time FROM company_hour_overrides WHERE company_id = ? AND date = CURDATE()'
    );
    $stmt->execute([$companyId]);
    $r = $stmt->fetch();
    if (!$r) return null;
    return [
        'is_open'    => (bool) $r['is_open'],
        'open_time'  => $r['open_time'] ? substr($r['open_time'], 0, 5) : null,
        'close_time' => $r['close_time'] ? substr($r['close_time'], 0, 5) : null,
    ];
}

/**
 * Effective status right now.
 * Returns ['configured'=>bool, 'open_now'=>bool|null, 'today'=>array|null, 'is_override'=>bool]
 * open_now is null when the company never set any hours.
 */
function company_open_status(PDO $pdo, int $companyId): array
{
    $weekly   = company_weekly_hours($pdo, $companyId);
    $override = company_today_override($pdo, $companyId);

    if (!$weekly && !$override) {
        return ['configured' => false, 'open_now' => null, 'today' => null, 'is_override' => false];
    }

    $today = $override ?? ($weekly[(int) date('w')] ?? null);
    if ($today === null || !$today['is_open'] || !$today['open_time'] || !$today['close_time']) {
        return [
            'configured'  => true,
            'open_now'    => false,
            'today'       => $today,
            'is_override' => $override !== null,
        ];
    }

    $now   = date('H:i');
    $open  = $today['open_time'];
    $close = $today['close_time'];

    if ($open === $close) {
        $isOpen = true; // same time = open 24h
    } elseif ($close > $open) {
        $isOpen = ($now >= $open && $now < $close);
    } else {
        // Overnight schedule, e.g. 18:00–02:00.
        $isOpen = ($now >= $open || $now < $close);
    }

    return [
        'configured'  => true,
        'open_now'    => $isOpen,
        'today'       => $today,
        'is_override' => $override !== null,
    ];
}
