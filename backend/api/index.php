<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/fields.php';
require_once __DIR__ . '/employees.php';
require_once __DIR__ . '/stats.php';
require_once __DIR__ . '/export.php';

$method = method();
$segments = path_segments();

try {
    if ($segments === []) {
        json_error('Not found.', 404);
    }

    $resource = array_shift($segments);

    switch ($resource) {
        case 'fields':
            if ($segments === [] && $method === 'GET') {
                json_response(fields_list());
            } elseif ($segments === [] && $method === 'POST') {
                fields_create();
            } elseif ($segments === ['reorder'] && $method === 'POST') {
                fields_reorder();
            } elseif (count($segments) === 1 && ctype_digit($segments[0]) && $method === 'PUT') {
                fields_update((int)$segments[0]);
            } elseif (count($segments) === 1 && ctype_digit($segments[0]) && $method === 'DELETE') {
                fields_delete((int)$segments[0]);
            } else {
                json_error('Route tidak ditemukan.', 404);
            }
            break;

        case 'employees':
            if ($segments === [] && $method === 'GET') {
                employees_list();
            } elseif ($segments === [] && $method === 'POST') {
                employees_create();
            } elseif (count($segments) === 1 && ctype_digit($segments[0]) && $method === 'GET') {
                employees_get((int)$segments[0]);
            } elseif (count($segments) === 1 && ctype_digit($segments[0]) && $method === 'PUT') {
                employees_update((int)$segments[0]);
            } elseif (count($segments) === 1 && ctype_digit($segments[0]) && $method === 'DELETE') {
                employees_delete((int)$segments[0]);
            } else {
                json_error('Route tidak ditemukan.', 404);
            }
            break;

        case 'stats':
            if ($segments === [] && $method === 'GET') {
                stats_get();
            } else {
                json_error('Route tidak ditemukan.', 404);
            }
            break;

        case 'export':
            if ($segments === [] && $method === 'GET') {
                export_xlsx();
            } else {
                json_error('Route tidak ditemukan.', 404);
            }
            break;

        default:
            json_error('Route tidak ditemukan.', 404);
    }
} catch (Throwable $e) {
    json_error('Terjadi kesalahan server: ' . $e->getMessage(), 500);
}