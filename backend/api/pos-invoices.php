<?php
/**
 * POS invoices for the logged-in COMPANY.
 *   GET            -> { invoices: [{id,invoice_no,customer_name,total,created_at}] } (latest 50)
 *   GET ?id=       -> { invoice: {..., items:[...] } }
 *   POST           -> create an invoice from a cart:
 *                     { customer_name?, discount?, paid?, items:[{product_id?,qty}] }
 *                     Totals are always recomputed here from the company's own
 *                     product prices — the client's numbers are never trusted.
 *
 * Scoped to the caller's company throughout.
 */
require_once __DIR__ . '/_bootstrap.php';

$user = require_api_user();
if ($user['user_type'] !== 'company') json_error('Forbidden', 403);

$pdo = db();
$stmt = $pdo->prepare('SELECT id FROM companies WHERE user_id = ?');
$stmt->execute([$user['id']]);
$cid = (int) ($stmt->fetchColumn() ?: 0);
if (!$cid) json_error('Company not found', 404);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET' && isset($_GET['id'])) {
    $id = (int) $_GET['id'];
    $inv = $pdo->prepare('SELECT * FROM pos_invoices WHERE id = ? AND company_id = ?');
    $inv->execute([$id, $cid]);
    $invoice = $inv->fetch();
    if (!$invoice) json_error('Invoice not found', 404);

    $items = $pdo->prepare('SELECT product_name, price, qty, line_total FROM pos_invoice_items WHERE invoice_id = ?');
    $items->execute([$id]);
    $invoice['items'] = array_map(fn ($r) => [
        'product_name' => $r['product_name'],
        'price'        => (float) $r['price'],
        'qty'          => (int) $r['qty'],
        'line_total'   => (float) $r['line_total'],
    ], $items->fetchAll());
    foreach (['subtotal', 'discount', 'total', 'paid'] as $k) $invoice[$k] = (float) $invoice[$k];
    $invoice['id'] = (int) $invoice['id'];
    json_out(['invoice' => $invoice]);
}

if ($method === 'GET') {
    $rows = $pdo->prepare(
        'SELECT id, invoice_no, customer_name, total, created_at
         FROM pos_invoices WHERE company_id = ? ORDER BY id DESC LIMIT 50'
    );
    $rows->execute([$cid]);
    json_out(['invoices' => array_map(fn ($r) => [
        'id'            => (int) $r['id'],
        'invoice_no'    => $r['invoice_no'],
        'customer_name' => $r['customer_name'],
        'total'         => (float) $r['total'],
        'created_at'    => $r['created_at'],
    ], $rows->fetchAll())]);
}

if ($method === 'POST') {
    $in    = json_in();
    $items = $in['items'] ?? [];
    if (!is_array($items) || count($items) === 0) json_error('Add at least one item to the invoice.', 422);

    $customer = trim((string) ($in['customer_name'] ?? '')) ?: 'Walk-in';
    $discount = max(0, (float) ($in['discount'] ?? 0));
    $paid     = max(0, (float) ($in['paid'] ?? 0));

    // Bill straight off the company's own menu: prices and names come from
    // menu_items (scoped to this company, available items only), never the
    // request, so the POS always matches what the kitchen offers.
    $ids = [];
    foreach ($items as $it) {
        $pid = (int) ($it['product_id'] ?? 0);
        if ($pid > 0) $ids[$pid] = true;
    }
    $products = [];
    if ($ids) {
        $place = implode(',', array_fill(0, count($ids), '?'));
        $q = $pdo->prepare("SELECT id, name, price FROM menu_items WHERE company_id = ? AND is_available = 1 AND id IN ($place)");
        $q->execute([$cid, ...array_keys($ids)]);
        foreach ($q->fetchAll() as $p) $products[(int) $p['id']] = $p;
    }

    // Build normalised lines from trusted data.
    $lines = [];
    $subtotal = 0.0;
    foreach ($items as $it) {
        $pid = (int) ($it['product_id'] ?? 0);
        $qty = (int) ($it['qty'] ?? 0);
        if ($qty <= 0) json_error('Every item needs a quantity of at least 1.', 422);
        if (!isset($products[$pid])) json_error('One of the items is no longer on the menu.', 422);
        $p = $products[$pid];
        $price = (float) $p['price'];
        $lineTotal = $price * $qty;
        $subtotal += $lineTotal;
        $lines[] = [
            'product_id'   => $pid,
            'product_name' => $p['name'],
            'price'        => $price,
            'qty'          => $qty,
            'line_total'   => $lineTotal,
        ];
    }

    if ($discount > $subtotal) $discount = $subtotal;
    $total = $subtotal - $discount;

    $pdo->beginTransaction();
    try {
        // Per-company running number: INV-YYYYMMDD-#### within this company.
        $seq = (int) $pdo->query("SELECT COUNT(*) FROM pos_invoices WHERE company_id = $cid")->fetchColumn() + 1;
        $invoiceNo = 'INV-' . date('Ymd') . '-' . str_pad((string) $seq, 4, '0', STR_PAD_LEFT);

        $pdo->prepare(
            'INSERT INTO pos_invoices (company_id, invoice_no, customer_name, user_id, subtotal, discount, total, paid)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$cid, $invoiceNo, $customer, $user['id'], $subtotal, $discount, $total, $paid]);
        $invoiceId = (int) $pdo->lastInsertId();

        $itemStmt = $pdo->prepare(
            'INSERT INTO pos_invoice_items (invoice_id, product_id, product_name, price, qty, line_total)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        foreach ($lines as $l) {
            $itemStmt->execute([$invoiceId, $l['product_id'], $l['product_name'], $l['price'], $l['qty'], $l['line_total']]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_error('Could not save the invoice. Please try again.', 500);
    }

    json_out([
        'invoice_id' => $invoiceId,
        'invoice_no' => $invoiceNo,
        'subtotal'   => $subtotal,
        'discount'   => $discount,
        'total'      => $total,
    ], 201);
}

json_error('Method not allowed', 405);
