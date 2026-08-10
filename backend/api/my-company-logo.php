<?php
/** Company logo (profile picture). POST multipart "logo" / DELETE. */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/upload.php';

company_image_endpoint('logo', 'logos', 5 * 1024 * 1024); // 5 MB
