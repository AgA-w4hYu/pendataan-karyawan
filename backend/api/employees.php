<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/helpers.php';

function normalize_value(array $field, $value): ?string
{
    if ($value === null || trim((string)$value) === '') {
        return null;
    }
    $value = trim((string)$value);
    $label = $field['label'];

    switch ($field['field_type']) {
        case 'number':
            if (!is_numeric($value)) {
                json_error("Nilai untuk field \"{$label}\" harus berupa angka.");
            }
            return $value;
        case 'date':
            $dt = DateTime::createFromFormat('Y-m-d', $value);
            if (!$dt || $dt->format('Y-m-d') !== $value) {
                json_error("Nilai untuk field \"{$label}\" harus berupa tanggal (format YYYY-MM-DD).");
            }
            return $value;
        case 'dropdown':
            $options = json_decode((string)$field['options'], true) ?: [];
            if (!in_array($value, $options, true)) {
                json_error("Nilai untuk field \"{$label}\" bukan salah satu pilihan yang tersedia.");
            }
            return $value;
        default:
            return mb_strlen($value) > 65535 ? mb_substr($value, 0, 65535) : $value;
    }
}

function normalize_biodata(array $biodata): array
{
    if (!$biodata) {
        return [];
    }
    $fields = [];
    foreach (db()->query('SELECT id, label, field_type, options FROM biodata_fields')->fetchAll() as $f) {
        $fields[(int)$f['id']] = $f;
    }
    $normalized = [];
    foreach ($biodata as $fieldId => $val) {
        $fieldId = (int)$fieldId;
        if (!isset($fields[$fieldId])) {
            continue;
        }
        $normalized[$fieldId] = normalize_value($fields[$fieldId], $val);
    }
    return $normalized;
}

function upsert_biodata(PDO $pdo, int $employeeId, array $normalized): void
{
    if (!$normalized) {
        return;
    }
    $upsert = $pdo->prepare('INSERT INTO employee_biodata (employee_id, field_id, value)
                             VALUES (?, ?, ?)
                             ON DUPLICATE KEY UPDATE value = VALUES(value)');
    foreach ($normalized as $fieldId => $val) {
        $upsert->execute([$employeeId, (int)$fieldId, $val]);
    }
}

function employees_one(int $id): array
{
    $stmt = db()->prepare('SELECT id, nama_lengkap, created_at, updated_at FROM employees WHERE id = ?');
    $stmt->execute([$id]);
    $employee = $stmt->fetch();
    if (!$employee) {
        json_error('Personel tidak ditemukan.', 404);
    }
    $employee['biodata'] = [];
    $stmt = db()->prepare('SELECT field_id, value FROM employee_biodata WHERE employee_id = ?');
    $stmt->execute([$id]);
    foreach ($stmt->fetchAll() as $row) {
        $employee['biodata'][(string)$row['field_id']] = $row['value'];
    }
    return $employee;
}

function employees_get(int $id): void
{
    json_response(employees_one($id));
}

function employees_list(): void
{
    $pdo = db();
    $search = trim((string)($_GET['search'] ?? ''));
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(1, (int)($_GET['per_page'] ?? 20)));

    $conditions = [];
    $params = [];
    if ($search !== '') {
        $conditions[] = 'e.nama_lengkap LIKE ?';
        $params[] = '%' . addcslashes($search, '%_\\') . '%';
    }
    [$filterChunks, $filterParams] = dropdown_filter_sql();
    if ($filterChunks) {
        $conditions = array_merge($conditions, $filterChunks);
        $params = array_merge($params, $filterParams);
    }
    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM employees e $where");
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    $offset = ($page - 1) * $perPage;
    $stmt = $pdo->prepare("SELECT id, nama_lengkap, created_at, updated_at
                           FROM employees e $where
                           ORDER BY e.nama_lengkap ASC, e.id ASC
                           LIMIT $perPage OFFSET $offset");
    $stmt->execute($params);
    $employees = $stmt->fetchAll();

    if (count($employees) > 0) {
        $ids = array_column($employees, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare("SELECT employee_id, field_id, value
                               FROM employee_biodata
                               WHERE employee_id IN ($placeholders)");
        $stmt->execute($ids);
        $map = [];
        foreach ($stmt->fetchAll() as $row) {
            $map[$row['employee_id']][(string)$row['field_id']] = $row['value'];
        }
        foreach ($employees as &$employee) {
            $employee['biodata'] = $map[$employee['id']] ?? [];
        }
        unset($employee);
    }

    json_response([
        'data'        => $employees,
        'total'       => $total,
        'page'        => $page,
        'per_page'    => $perPage,
        'total_pages' => max(1, (int)ceil($total / $perPage)),
    ]);
}

function employees_create(): void
{
    $data = body();
    $nama = clean_text($data['nama_lengkap'] ?? '', 255);
    if ($nama === '') {
        json_error('Nama Lengkap wajib diisi.');
    }
    $pdo = db();
    // Validasi seluruh nilai biodata DULU, sebelum ada data yang ditulis.
    $normalized = normalize_biodata($data['biodata'] ?? []);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO employees (nama_lengkap) VALUES (?)');
        $stmt->execute([$nama]);
        $id = (int)$pdo->lastInsertId();
        upsert_biodata($pdo, $id, $normalized);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    json_response(employees_one($id), 201);
}

function employees_update(int $id): void
{
    $data = body();
    $nama = clean_text($data['nama_lengkap'] ?? '', 255);
    if ($nama === '') {
        json_error('Nama Lengkap wajib diisi.');
    }
    $pdo = db();
    $check = $pdo->prepare('SELECT 1 FROM employees WHERE id = ?');
    $check->execute([$id]);
    if (!$check->fetchColumn()) {
        json_error('Personel tidak ditemukan.', 404);
    }

    $normalized = normalize_biodata($data['biodata'] ?? []);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('UPDATE employees SET nama_lengkap = ? WHERE id = ?');
        $stmt->execute([$nama, $id]);
        upsert_biodata($pdo, $id, $normalized);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    json_response(employees_one($id));
}

function employees_delete(int $id): void
{
    $pdo = db();
    // Hard delete — data personel + seluruh biodatanya terhapus permanen (ON DELETE CASCADE).
    $stmt = $pdo->prepare('DELETE FROM employees WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) {
        json_error('Personel tidak ditemukan.', 404);
    }
    json_response(['ok' => true]);
}