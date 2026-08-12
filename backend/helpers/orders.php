<?php
/**
 * Shared helpers for dine-in orders, so the guest's ordering page, the guest's
 * status poll and the company's kitchen screen all shape an order the same way.
 */
require_once __DIR__ . '/urls.php';

/** The states an order moves through, in order. */
const ORDER_STATUSES = ['placed', 'preparing', 'served', 'cancelled'];

/**
 * A short code staff and guests read out loud ("order K7Q4").
 *
 * The alphabet drops O/0 and I/1 — a code is useless if it can't be repeated
 * across a noisy dining room without ambiguity. Looped against the table so a
 * collision retries instead of failing the guest's order.
 */
function new_order_ref(PDO $pdo): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $stmt = $pdo->prepare('SELECT id FROM orders WHERE ref = ?');
    do {
        $ref = '';
        for ($i = 0; $i < 5; $i++) $ref .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        $stmt->execute([$ref]);
    } while ($stmt->fetchColumn());
    return $ref;
}

/** The lines of one order, in the sequence they were added. */
function order_items(PDO $pdo, int $orderId): array
{
    $stmt = $pdo->prepare('SELECT menu_item_id, name, price, qty FROM order_items WHERE order_id = ? ORDER BY id');
    $stmt->execute([$orderId]);
    return array_map(fn ($r) => [
        'menu_item_id' => $r['menu_item_id'] !== null ? (int) $r['menu_item_id'] : null,
        'name'         => $r['name'],
        'price'        => (float) $r['price'],
        'qty'          => (int) $r['qty'],
    ], $stmt->fetchAll());
}

/** Shape one order row for JSON. Items are attached separately by the caller. */
function order_row(array $r): array
{
    return [
        'id'          => (int) $r['id'],
        'ref'         => $r['ref'],
        'table_label' => $r['table_label'],
        'name'        => $r['name'],
        'mobile'      => $r['mobile'],
        'people'      => (int) $r['people'],
        'note'        => $r['note'],
        'total'       => (float) $r['total'],
        'status'      => $r['status'],
        'created_at'  => $r['created_at'],
    ];
}

/**
 * Price a guest's cart against the company's live menu.
 *
 * Nothing the browser sent about a dish is trusted — only the id and quantity.
 * Names and prices are read fresh from the menu, so a tampered request cannot
 * order a Rs 2,000 dish for Rs 20, and an item switched off in the meantime is
 * dropped rather than sold.
 *
 * @return array{0: array<int,array>, 1: float} the priced lines and their total
 */
function price_order_lines(PDO $pdo, int $companyId, array $cart): array
{
    $lines = [];
    $total = 0.0;

    $lookup = $pdo->prepare('SELECT name, price FROM menu_items WHERE id = ? AND company_id = ? AND is_available = 1');
    $seen = [];

    foreach ($cart as $row) {
        $mid = (int) ($row['menu_item_id'] ?? 0);
        $qty = (int) ($row['qty'] ?? 0);
        if ($mid <= 0 || $qty <= 0) continue;
        if ($qty > 99) $qty = 99;
        // A cart that repeats a dish is folded into one line rather than two.
        if (isset($seen[$mid])) {
            $i = $seen[$mid];
            $lines[$i]['qty'] = min(99, $lines[$i]['qty'] + $qty);
            continue;
        }

        $lookup->execute([$mid, $companyId]);
        $item = $lookup->fetch();
        if (!$item) continue;

        $seen[$mid] = count($lines);
        $lines[] = [
            'menu_item_id' => $mid,
            'name'         => $item['name'],
            'price'        => (float) $item['price'],
            'qty'          => $qty,
        ];
    }

    foreach ($lines as $l) $total += $l['price'] * $l['qty'];

    return [$lines, round($total, 2)];
}
