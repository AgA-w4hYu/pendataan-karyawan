<?php
declare(strict_types=1);

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/');

// Semua rute API diteruskan ke front controller
if (str_starts_with($uri, '/api/')) {
    require __DIR__ . '/backend/api/index.php';
    return true;
}

// File statis dari hasil build frontend (public/)
$file = __DIR__ . '/public' . $uri;
if ($uri !== '/' && is_file($file)) {
    return false; // biarkan built-in server melayani file statis
}

// Fallback SPA — semua rute lain mengembalikan index.html
$index = __DIR__ . '/public/index.html';
if (is_file($index)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($index);
} else {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Frontend belum di-build. Jalankan `npm run build` di folder frontend/.';
}
return true;