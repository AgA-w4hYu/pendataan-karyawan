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
 * hanya filter untuk kolom bertipe dropdown / ordered_select. Kolom yang bukan
 * salah satunya / tidak dikenal / nilai kosong otomatis diabaikan.
 *
 * Nilai filter: label teks utk dropdown, id opsi (string) utk ordered_select.
 * Contoh: /api/employees?filters={"3":"Finance","5":"12"}
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

    $filterableTypes = [];
    foreach (db()->query("SELECT id, field_type FROM biodata_fields
                          WHERE field_type IN ('dropdown','ordered_select')")->fetchAll() as $f) {
        $filterableTypes[(int)$f['id']] = $f['field_type'];
    }

    $filters = [];
    foreach ($decoded as $fieldId => $value) {
        $fieldId = (int)$fieldId;
        $value = trim((string)$value);
        if ($value === '' || !isset($filterableTypes[$fieldId])) {
            continue;
        }
        $filters[$fieldId] = ['value' => $value, 'type' => $filterableTypes[$fieldId]];
    }
    return $filters;
}

/**
 * Bangun klausa WHERE EXISTS untuk filter kolom dropdown / ordered_select.
 * Mengembalikan [sqlChunks, params] siap digabung ke query personel.
 * ordered_select dibandingkan numerik (value menyimpan id opsi) agar bebas
 * dari masalah perbedaan collation antar tabel.
 */
function dropdown_filter_sql(): array
{
    $chunks = [];
    $params = [];
    foreach (parse_dropdown_filters() as $fieldId => $f) {
        if ($f['type'] === 'ordered_select') {
            $chunks[] = 'EXISTS (SELECT 1 FROM employee_biodata bf
                        WHERE bf.employee_id = e.id AND bf.field_id = ? AND CAST(bf.value AS UNSIGNED) = ?)';
            $params[] = $fieldId;
            $params[] = (int)$f['value'];
        } else {
            $chunks[] = 'EXISTS (SELECT 1 FROM employee_biodata bf
                        WHERE bf.employee_id = e.id AND bf.field_id = ? AND bf.value = ?)';
            $params[] = $fieldId;
            $params[] = $f['value'];
        }
    }
    return [$chunks, $params];
}