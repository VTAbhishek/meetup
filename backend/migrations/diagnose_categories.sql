-- ============================================================
--  WHY DOES "Browse by category" SHOW 0 COMPANIES?
--
--  Paste into phpMyAdmin (select your database in the LEFT sidebar first)
--  and press Go. This only READS — it changes nothing.
--
--  A company is counted on that page only when BOTH are true:
--    1. its `category` matches a row in the `categories` table, and
--    2. its `status` is 'active' (i.e. an admin has approved it).
--
--  Each result below tells you which of those is failing.
-- ============================================================


-- ---- 1. How many companies exist, and are they approved? ----
--  Anything not 'active' is invisible on the category pages.
--  Fix: Admin panel -> Companies -> set the status to Active.
SELECT '1. companies by status' AS report, `status`, COUNT(*) AS how_many
  FROM `companies`
 GROUP BY `status`;


-- ---- 2. Companies with no category at all ----
--  Fix: Admin panel -> Companies -> open the company -> pick a category.
--  (Or the company itself: Edit profile on its dashboard.)
SELECT '2. no category set' AS report, `id`, `company_name`, `status`
  FROM `companies`
 WHERE `category` IS NULL OR TRIM(`category`) = ''
 ORDER BY `id`;


-- ---- 3. Companies whose category doesn't match the list ----
--  A category typed differently ("Electronics and Technology" vs the
--  "Electronics & Technology" in the list) matches no page at all.
--  Fix: re-pick the category from the dropdown so it matches exactly,
--  or add the missing name in Admin panel -> Categories.
SELECT '3. category not in the list' AS report,
       c.`id`, c.`company_name`, c.`category` AS company_says, c.`status`
  FROM `companies` c
 WHERE c.`category` IS NOT NULL AND TRIM(c.`category`) <> ''
   AND NOT EXISTS (SELECT 1 FROM `categories` cat WHERE cat.`name` = TRIM(c.`category`))
 ORDER BY c.`id`;


-- ---- 4. What the page will show right now ----
--  This is the exact count the website uses. Every row reading 0 while
--  results 1-3 look fine means the companies simply aren't active yet.
SELECT '4. what the page shows' AS report,
       cat.`name` AS category,
       (SELECT COUNT(*) FROM `companies` c
         WHERE TRIM(c.`category`) = cat.`name` AND c.`status` = 'active') AS companies,
       (SELECT COUNT(*) FROM `reviews` r
          JOIN `companies` c ON c.`id` = r.`company_id`
         WHERE TRIM(c.`category`) = cat.`name` AND c.`status` = 'active'
           AND r.`is_approved` = 1) AS reviews
  FROM `categories` cat
 ORDER BY cat.`name`;
