<?php
declare(strict_types=1);

// Catatan: return type `never` (PHP 8.1+) sengaja TIDAK dipakai agar
// aplikasi tetap berjalan di XAMPP lama (PHP 8.0). Kedua fungsi ini
// selalu menghentikan eksekusi (exit), jadi aman tanpa return type.
function json_response($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $message, int $status = 400): void
{
    json_response(['error' => $message], $status);
}

function method(): string
{
    return $_SERVER['REQUEST_METHOD'] ?? 'GET';
}

function body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    return is_array($data) ? $data : [];
}

function path_segments(): array
{
    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
    $uri = preg_replace('#^/api/?#', '', $uri) ?? '';
    return array_values(array_filter(explode('/', $uri), fn($s) => $s !== ''));
}

function clean_text($value, int $max = 255): string
{
    $value = trim((string)$value);
    return mb_strlen($value) > $max ? mb_substr($value, 0, $max) : $value;
}

/**
 * Baca parameter GET `filters` (objek JSON: { idField: nilai }) dan kembalikan
 * hanya filter untuk kolom bertipe dropdown. Kolom yang bukan dropdown / tidak
 * dikenal / nilai kosong otomatis diabaikan.
 *
 * Contoh: /api/employees?filters={"3":"Finance"}
 */
function parse_dropdown_filters(): array
{
    $raw = $_GET['filters'] ?? '';
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded) || $decoded === []) {
        return [];
    }

    $dropdownIds = [];
    foreach (db()->query("SELECT id FROM biodata_fields WHERE field_type = 'dropdown'")->fetchAll() as $f) {
        $dropdownIds[(int)$f['id']] = true;
    }

    $filters = [];
    foreach ($decoded as $fieldId => $value) {
        $fieldId = (int)$fieldId;
        $value = trim((string)$value);
        if ($value === '' || !isset($dropdownIds[$fieldId])) {
            continue;
        }
        $filters[$fieldId] = $value;
    }
    return $filters;
}

/**
 * Bangun klausa WHERE EXISTS untuk filter kolom dropdown.
 * Mengembalikan [sqlChunks, params] siap digabung ke query karyawan.
 */
function dropdown_filter_sql(): array
{
    $chunks = [];
    $params = [];
    foreach (parse_dropdown_filters() as $fieldId => $value) {
        $chunks[] = 'EXISTS (SELECT 1 FROM employee_biodata bf
                    WHERE bf.employee_id = e.id AND bf.field_id = ? AND bf.value = ?)';
        $params[] = $fieldId;
        $params[] = $value;
    }
    return [$chunks, $params];
}