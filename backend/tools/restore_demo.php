<?php
/**
 * Non-destructive restore of the demo companies + reviews.
 * Keeps any real registered businesses and existing users.
 * Run:  php backend/tools/restore_demo.php
 */
require_once __DIR__ . '/../config/db.php';
$pdo = db();

function slugify($s) {
    $s = strtolower(trim($s));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim($s, '-');
}

// Ensure the 8 demo customers exist (INSERT IGNORE keeps existing ones).
$customers = [
    ['Carolyne Lee', 'carolyne'], ['David Rader', 'david_r'], ['DeeAnn Pattison', 'deeann'],
    ['James Tonnesen', 'james_t'], ['Matthew Lopez', 'matthewl'], ['Donyae Davis', 'donyae'],
    ['Yaqoob Saleem', 'yaqoob'], ['Anthony R', 'anthony_r'],
];
$pw  = password_hash('password123', PASSWORD_DEFAULT);
$insU = $pdo->prepare("INSERT IGNORE INTO users (user_type, full_name, username, email, password, is_verified, status)
                       VALUES ('customer', ?, ?, ?, ?, 1, 'active')");
foreach ($customers as $c) {
    $insU->execute([$c[0], $c[1], $c[1] . '@demo.test', $pw]);
}
$custIds = $pdo->query("SELECT id FROM users WHERE email LIKE '%@demo.test'")->fetchAll(PDO::FETCH_COLUMN);

// Demo companies (only inserted if the slug isn't already present).
$companies = [
    ['Happen Bank', 'happen.com', 'Bank', 'Modern online banking with fast loans and 24/7 support.'],
    ['AARDY', 'aardy.com', 'Travel Insurance', 'Compare travel insurance quotes from top providers instantly.'],
    ['Travel Defenders', 'traveldefenders.com', 'Travel Insurance', 'Trusted travel protection for every journey.'],
    ['MexiPass', 'mexipass.com', 'Travel Insurance', 'Mexican insurance, the American way.'],
    ['TripInsure101', 'tripinsure101.com', 'Travel Insurance', 'Simple, affordable trip insurance for travelers.'],
    ['HMD Global', 'hmdglobal.com', 'Electronics & Technology', 'Phones and devices built to last.'],
    ['LINTICO', 'linticoshop.com', 'Clothing Store', 'Premium linen outfits and timeless fashion.'],
    ['Retrolocker', 'retrolocker.com', 'Clothing Store', 'Retro jerseys and vintage sportswear.'],
    ['NordHome', 'nordhome.com', 'Furniture Store', 'Scandinavian furniture for modern living.'],
    ['DriveMax', 'drivemax.com', 'Car Dealer', 'Quality used cars with transparent pricing.'],
    ['LuxGems', 'luxgems.com', 'Jewelry Store', 'Handcrafted fine jewelry and engagement rings.'],
    ['FitFuel', 'fitfuel.com', 'Fitness and Nutrition Service', 'Personalized nutrition and fitness coaching.'],
];
$check = $pdo->prepare('SELECT id FROM companies WHERE slug = ?');
$insC  = $pdo->prepare("INSERT INTO companies (user_id, company_name, slug, website, category, description, is_approved, status)
                        VALUES (NULL, ?, ?, ?, ?, ?, 1, 'active')");
$newIds = [];
foreach ($companies as $c) {
    $slug = slugify($c[0]);
    $check->execute([$slug]);
    if ($check->fetch()) continue;
    $insC->execute([$c[0], $slug, $c[1], $c[2], $c[3]]);
    $newIds[] = (int) $pdo->lastInsertId();
}

// Reviews for the freshly-added companies.
$pool = [
    [5, 'Fantastic experience', 'So easy to apply. Approved fast and the whole process was smooth from start to finish. Will definitely use again.'],
    [5, 'Highly recommend', 'Great communication and helpful customer service representatives who answered all my questions quickly.'],
    [5, 'Exceeded expectations', 'Quality was better than I expected for the price. Packaging was excellent and delivery was quick.'],
    [4, 'Very good overall', 'Solid experience with only minor hiccups. Would happily come back for my next purchase.'],
    [4, 'Reliable and quick', 'Everything arrived on time and worked as described. Good value for money.'],
    [5, 'Best in the business', 'I have used many services like this and this one stands out for ethics and a realistic approach.'],
    [2, 'Could be better', 'The product was okay but the size was different from what I ordered. Support was slow to respond.'],
    [1, 'Buyer beware', 'My order looked different from the listing. It may have been my error but the return process was painful.'],
    [3, 'Average', 'Did the job but nothing special. Shipping took a little longer than promised.'],
    [5, 'Loved it', 'Looking for a nice outfit, I ordered and it came quickly and fit perfectly. Sound and quality excellent.'],
    [4, 'Good value', 'Prices are unbelievable and the quality holds up. Ordered several items and all were great.'],
    [5, 'Seamless and fast', 'Money in my account within 48 hours. Clear communication throughout. Couldn\'t be happier.'],
];
$insR = $pdo->prepare("INSERT INTO reviews (customer_id, company_id, rating, title, body, is_approved, useful_count, experience_date, created_at)
                       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)");
$count = 0;
foreach ($newIds as $cid) {
    $n = rand(3, 6);
    for ($i = 0; $i < $n; $i++) {
        $r = $pool[array_rand($pool)];
        $cust = $custIds[array_rand($custIds)];
        $days = rand(0, 40);
        $created = date('Y-m-d H:i:s', strtotime("-$days days -" . rand(0, 23) . ' hours'));
        $exp = date('Y-m-d', strtotime('-' . ($days + rand(0, 5)) . ' days'));
        $insR->execute([$cust, $cid, $r[0], $r[1], $r[2], rand(0, 45), $exp, $created]);
        $count++;
    }
}
echo 'Restored ' . count($newIds) . " companies and $count reviews.\n";
