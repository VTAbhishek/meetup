<?php
/**
 * The public mood vocabulary, used by the customer filter chips.
 *   GET -> { moods: [{id,slug,name,hint,icon}] }
 */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/moods.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

json_out(['moods' => mood_catalogue(db())]);
