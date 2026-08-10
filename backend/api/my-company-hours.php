<?php
/**
 * Opening hours for the logged-in company.
 *   GET                  -> { hours:[7 weekday rows], today_override, status }
 *   POST { hours:[…] }   -> save the weekly schedule (all 7 days)
 *   POST { today:{…} }   -> set an override FOR TODAY ONLY (special hours / closed)
 *   DELETE ?today=1      -> remove today's override (back to the weekly schedule)
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/hours.php';

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$pdo = db();
$stmt = $pdo->prepare('SELECT id FROM companies WHERE user_id = ?');
$stmt->execute([$user['id']]);
$cid = (int) ($stmt->fetchColumn() ?: 0);
if (!$cid) json_error('Company not found', 404);

$method = $_SERVER['REQUEST_METHOD'];

/** Shared response payload. */
function hours_payload(PDO $pdo, int $cid): array
{
    return [
        'hours'          => array_values(company_weekly_hours($pdo, $cid)),
        'today_override' => company_today_override($pdo, $cid),
        'status'         => company_open_status($pdo, $cid),
    ];
}

function valid_time(?string $t): bool
{
    return is_string($t) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $t);
}

if ($method === 'GET') {
    json_out(hours_payload($pdo, $cid));
}

if ($method === 'POST') {
    $in = json_in();

    // ---- Save the weekly schedule ----
    if (isset($in['hours']) && is_array($in['hours'])) {
        $rows = [];
        foreach ($in['hours'] as $h) {
            $day = (int) ($h['weekday'] ?? -1);
            if ($day < 0 || $day > 6) json_error('Invalid weekday.', 422);
            $isOpen = !empty($h['is_open']);
            $open   = $h['open_time'] ?? null;
            $close  = $h['close_time'] ?? null;
            if ($isOpen && (!valid_time($open) || !valid_time($close))) {
                json_error('Open days need both a from and a to time (HH:MM).', 422);
            }
            $rows[$day] = [$isOpen ? 1 : 0, $isOpen ? $open : null, $isOpen ? $close : null];
        }
        if (count($rows) !== 7) json_error('All 7 days are required.', 422);

        $pdo->beginTransaction();
        try {
            $up = $pdo->prepare(
                'INSERT INTO company_hours (company_id, weekday, is_open, open_time, close_time)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE is_open = VALUES(is_open),
                                         open_time = VALUES(open_time),
                                         close_time = VALUES(close_time)'
            );
            foreach ($rows as $day => [$isOpen, $open, $close]) {
                $up->execute([$cid, $day, $isOpen, $open, $close]);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            json_error('Could not save the schedule. Please try again.', 500);
        }
        json_out(hours_payload($pdo, $cid));
    }

    // ---- Override TODAY only ----
    if (isset($in['today']) && is_array($in['today'])) {
        $t      = $in['today'];
        $isOpen = !empty($t['is_open']);
        $open   = $t['open_time'] ?? null;
        $close  = $t['close_time'] ?? null;
        if ($isOpen && (!valid_time($open) || !valid_time($close))) {
            json_error('Special hours need both a from and a to time (HH:MM).', 422);
        }
        $pdo->prepare(
            'INSERT INTO company_hour_overrides (company_id, date, is_open, open_time, close_time)
             VALUES (?, CURDATE(), ?, ?, ?)
             ON DUPLICATE KEY UPDATE is_open = VALUES(is_open),
                                     open_time = VALUES(open_time),
                                     close_time = VALUES(close_time)'
        )->execute([$cid, $isOpen ? 1 : 0, $isOpen ? $open : null, $isOpen ? $close : null]);

        json_out(hours_payload($pdo, $cid));
    }

    json_error('Nothing to save.', 422);
}

if ($method === 'DELETE') {
    $pdo->prepare('DELETE FROM company_hour_overrides WHERE company_id = ? AND date = CURDATE()')
        ->execute([$cid]);
    json_out(hours_payload($pdo, $cid));
}

json_error('Method not allowed', 405);
