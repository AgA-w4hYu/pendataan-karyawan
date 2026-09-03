<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/helpers.php';

const FIELD_TYPES = ['text', 'date', 'number', 'dropdown'];

function fields_list(): array
{
    $rows = db()->query('SELECT id, label, field_type, options, urutan, created_at
                         FROM biodata_fields ORDER BY urutan ASC, id ASC')->fetchAll();
    foreach ($rows as &$row) {
        $decoded = json_decode((string)$row['options'], true);
        $row['options'] = is_array($decoded) ? array_values($decoded) : [];
    }
    unset($row);
    return $rows;
}

function validate_field(array $data): array
{
    $label = clean_text($data['label'] ?? '', 255);
    if ($label === '') {
        json_error('Label field tidak boleh kosong.');
    }

    $type = $data['field_type'] ?? 'text';
    if (!in_array($type, FIELD_TYPES, true)) {
        json_error('Tipe field tidak valid.');
    }

    $options = [];
    if ($type === 'dropdown') {
        $raw = $data['options'] ?? [];
        if (is_string($raw)) {
            $raw = preg_split('/[\r\n,]+/', $raw) ?: [];
        }
        $options = array_values(array_unique(array_filter(array_map(
            fn($o) => trim((string)$o),
            (array)$raw
        ), fn($o) => $o !== '')));
        if (count($options) === 0) {
            json_error('Field dropdown wajib memiliki minimal 1 pilihan.');
        }
    }

    return ['label' => $label, 'field_type' => $type, 'options' => $options];
}

function backfill_field(int $fieldId): void
{
    // Sedikan baris kosong utk semua personel yang sudah ada,
    // agar field langsung "muncul" untuk semua data.
    db()->prepare('INSERT IGNORE INTO employee_biodata (employee_id, field_id, value)
                   SELECT id, ?, NULL FROM employees')->execute([$fieldId]);
}

function fields_create(): void
{
    $field = validate_field(body());
    $pdo = db();
    $urutan = (int)$pdo->query('SELECT COALESCE(MAX(urutan), 0) + 1 FROM biodata_fields')->fetchColumn();
    $stmt = $pdo->prepare('INSERT INTO biodata_fields (label, field_type, options, urutan) VALUES (?, ?, ?, ?)');
    $stmt->execute([
        $field['label'],
        $field['field_type'],
        $field['options'] ? json_encode($field['options'], JSON_UNESCAPED_UNICODE) : null,
        $urutan,
    ]);
    backfill_field((int)$pdo->lastInsertId());
    json_response(fields_list(), 201);
}

function fields_update(int $id): void
{
    $field = validate_field(body());
    $pdo = db();
    $stmt = $pdo->prepare('UPDATE biodata_fields
                           SET label = ?, field_type = ?, options = ?
                           WHERE id = ?');
    $stmt->execute([
        $field['label'],
        $field['field_type'],
        $field['options'] ? json_encode($field['options'], JSON_UNESCAPED_UNICODE) : null,
        $id,
    ]);
    if ($stmt->rowCount() === 0) {
        $exists = $pdo->prepare('SELECT 1 FROM biodata_fields WHERE id = ?');
        $exists->execute([$id]);
        if (!$exists->fetchColumn()) {
            json_error('Field tidak ditemukan.', 404);
        }
    }
    backfill_field($id);
    json_response(fields_list());
}

function fields_delete(int $id): void
{
    $pdo = db();
    $stmt = $pdo->prepare('DELETE FROM biodata_fields WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) {
        json_error('Field tidak ditemukan.', 404);
    }
    json_response(['ok' => true]);
}

function fields_reorder(): void
{
    $ids = body()['ids'] ?? [];
    if (!is_array($ids)) {
        json_error('ids harus berupa array.');
    }
    $pdo = db();
    $stmt = $pdo->prepare('UPDATE biodata_fields SET urutan = ? WHERE id = ?');
    foreach (array_values($ids) as $index => $id) {
        $stmt->execute([$index, (int)$id]);
    }
    json_response(fields_list());
}