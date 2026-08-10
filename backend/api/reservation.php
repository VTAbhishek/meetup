<?php
/**
 * A single reservation, managed by the owning COMPANY.
 *   POST ?id=  { status?: 'confirmed'|'pending', reply?: string }
 *              -> update status and/or send a reply; notifies the customer.
 *   DELETE ?id=  -> delete the reservation; notifies the customer it was removed.
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/mail.php';

$id = (int) ($_GET['id'] ?? 0);
$method = $_SERVER['REQUEST_METHOD'];

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

// The reservation must belong to this company. Pull the company details and the
// customer's registration email so we can email a confirmation receipt.
$stmt = db()->prepare(
    'SELECT r.*,
            c.company_name, c.website, c.phone, c.address, c.category,
            u.email AS customer_email, u.full_name AS customer_fullname
     FROM reservations r
     JOIN companies c ON c.id = r.company_id
     JOIN users u ON u.id = r.customer_id
     WHERE r.id = ? AND c.user_id = ?'
);
$stmt->execute([$id, $user['id']]);
$res = $stmt->fetch();
if (!$res) json_error('Reservation not found', 404);

$company = $res['company_name'];
$when = date('M j, Y', strtotime($res['res_date'])) . ' · ' . substr($res['time_from'], 0, 5) . '–' . substr($res['time_to'], 0, 5);

/** Queue an in-app notification for the reservation's customer. */
function notify_customer(int $userId, string $title, string $body): void
{
    db()->prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, "reservation", ?, ?, "/dashboard")')
        ->execute([$userId, $title, $body]);
}

if ($method === 'POST') {
    $in     = json_in();
    $status = $in['status'] ?? null;
    $reply  = array_key_exists('reply', $in) ? trim((string) $in['reply']) : null;

    $fields = [];
    $params = [];
    if ($status !== null) {
        if (!in_array($status, ['pending', 'confirmed'], true)) json_error('Invalid status', 422);
        $fields[] = 'status = ?';
        $params[] = $status;
    }
    if ($reply !== null) {
        $fields[] = 'reply = ?';
        $params[] = $reply !== '' ? $reply : null;
    }
    if (!$fields) json_error('Nothing to update', 422);

    $params[] = $id;
    db()->prepare('UPDATE reservations SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);

    // Tell the customer what changed.
    if ($status === 'confirmed') {
        notify_customer((int) $res['customer_id'], "Reservation confirmed by $company", "$when" . ($reply ? " — \"$reply\"" : ''));

        // Email a branded confirmation receipt to the customer's registration
        // email (site name + company details + booking details).
        $res['reply'] = $reply !== null ? ($reply !== '' ? $reply : null) : ($res['reply'] ?? null);
        $emailSent = send_email(
            (string) $res['customer_email'],
            (string) $res['customer_fullname'],
            'Your reservation with ' . $company . ' is confirmed — ' . SITE_NAME,
            reservation_receipt_html([
                'company_name' => $res['company_name'],
                'category'     => $res['category'],
                'phone'        => $res['phone'],
                'website'      => $res['website'],
                'address'      => $res['address'],
            ], $res)
        );
        json_out(['ok' => true, 'email_sent' => (bool) $emailSent]);
    } elseif ($status === 'pending') {
        notify_customer((int) $res['customer_id'], "$company moved your reservation to pending", "$when" . ($reply ? " — \"$reply\"" : ''));
    } elseif ($reply !== null && $reply !== '') {
        notify_customer((int) $res['customer_id'], "$company replied to your reservation", "$when — \"$reply\"");
    }

    json_out(['ok' => true]);
}

if ($method === 'DELETE') {
    db()->prepare('DELETE FROM reservation_items WHERE reservation_id = ?')->execute([$id]);
    db()->prepare('DELETE FROM reservations WHERE id = ?')->execute([$id]);
    // Only notify when declining a still-pending booking. Deleting an
    // already-confirmed reservation is a silent cleanup — no notification.
    if ($res['status'] !== 'confirmed') {
        notify_customer((int) $res['customer_id'], "$company declined your reservation", "Your booking for $when was removed.");
    }
    json_out(['ok' => true]);
}

json_error('Method not allowed', 405);
