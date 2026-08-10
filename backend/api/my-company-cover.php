<?php
/** Company cover/banner image. POST multipart "cover" / DELETE. */
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/upload.php';

company_image_endpoint('cover', 'covers', 10 * 1024 * 1024); // 10 MB
