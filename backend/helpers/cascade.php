<?php
/**
 * Manual cascade deletes.
 *
 * The live `meetup` database was created without the ON DELETE CASCADE foreign
 * keys that database.sql declares, so deleting a user/company does NOT auto-remove
 * the dependent rows. These helpers delete children explicitly, in child→parent
 * order. Call them inside a transaction.
 */

/** Delete a company and everything hanging off it (replies, reviews, payments). */
function delete_company_deep(PDO $pdo, int $companyId): void
{
    // Replies on this company's reviews (matched both ways to be safe).
    $pdo->prepare('DELETE FROM review_replies WHERE company_id = ?')->execute([$companyId]);
    $pdo->prepare('DELETE FROM review_replies WHERE review_id IN (SELECT id FROM reviews WHERE company_id = ?)')->execute([$companyId]);
    $pdo->prepare('DELETE FROM reviews WHERE company_id = ?')->execute([$companyId]);
    $pdo->prepare('DELETE FROM payments WHERE company_id = ?')->execute([$companyId]);

    // Cover gallery images (files + rows).
    $covers = $pdo->prepare('SELECT path FROM company_covers WHERE company_id = ?');
    $covers->execute([$companyId]);
    foreach ($covers->fetchAll(PDO::FETCH_COLUMN) as $p) {
        $file = __DIR__ . '/../' . $p;
        if (is_file($file)) @unlink($file);
    }
    $pdo->prepare('DELETE FROM company_covers WHERE company_id = ?')->execute([$companyId]);

    // Showcase cards (files + rows).
    $cards = $pdo->prepare('SELECT thumb, image FROM company_cards WHERE company_id = ?');
    $cards->execute([$companyId]);
    foreach ($cards->fetchAll() as $c) {
        foreach ([$c['thumb'], $c['image']] as $p) {
            if ($p) { $f = __DIR__ . '/../' . $p; if (is_file($f)) @unlink($f); }
        }
    }
    $pdo->prepare('DELETE FROM company_cards WHERE company_id = ?')->execute([$companyId]);

    // Opening hours + per-date overrides.
    $pdo->prepare('DELETE FROM company_hours WHERE company_id = ?')->execute([$companyId]);
    $pdo->prepare('DELETE FROM company_hour_overrides WHERE company_id = ?')->execute([$companyId]);

    // Menu items (files + rows) and reservations (with their pre-ordered items).
    $menu = $pdo->prepare('SELECT image FROM menu_items WHERE company_id = ?');
    $menu->execute([$companyId]);
    foreach ($menu->fetchAll(PDO::FETCH_COLUMN) as $p) {
        if ($p) { $f = __DIR__ . '/../' . $p; if (is_file($f)) @unlink($f); }
    }
    $pdo->prepare('DELETE FROM menu_items WHERE company_id = ?')->execute([$companyId]);
    $pdo->prepare('DELETE FROM reservation_items WHERE reservation_id IN (SELECT id FROM reservations WHERE company_id = ?)')->execute([$companyId]);
    $pdo->prepare('DELETE FROM reservations WHERE company_id = ?')->execute([$companyId]);

    $pdo->prepare('DELETE FROM companies WHERE id = ?')->execute([$companyId]);
}

/**
 * Delete a user account and everything tied to it: any companies they own
 * (with those companies' reviews/replies/payments), the reviews they authored
 * as a customer, their auth tokens and OTP codes, then the user row itself.
 */
function delete_user_deep(PDO $pdo, int $userId): void
{
    // Companies owned by this user.
    $stmt = $pdo->prepare('SELECT id FROM companies WHERE user_id = ?');
    $stmt->execute([$userId]);
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $companyId) {
        delete_company_deep($pdo, (int) $companyId);
    }

    // Reviews this user wrote as a customer (+ their replies).
    $pdo->prepare('DELETE FROM review_replies WHERE review_id IN (SELECT id FROM reviews WHERE customer_id = ?)')->execute([$userId]);
    $pdo->prepare('DELETE FROM reviews WHERE customer_id = ?')->execute([$userId]);

    // Reservations this user made as a customer (+ their pre-ordered items).
    $pdo->prepare('DELETE FROM reservation_items WHERE reservation_id IN (SELECT id FROM reservations WHERE customer_id = ?)')->execute([$userId]);
    $pdo->prepare('DELETE FROM reservations WHERE customer_id = ?')->execute([$userId]);

    // Session tokens + OTP codes.
    $pdo->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$userId]);
    $pdo->prepare('DELETE FROM otp_codes WHERE user_id = ?')->execute([$userId]);

    // Finally the account.
    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
}
