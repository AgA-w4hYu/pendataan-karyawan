<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/helpers.php';

const FIELD_TYPES = ['text', 'date', 'number', 'dropdown', 'ordered_select'];

function fields_list(): array
{
    $rows = db()->query('SELECT id, label, field_type, options, urutan, created_at
                         FROM biodata_fields ORDER BY urutan ASC, id ASC')->fetchAll();

    // Opsi hierarki untuk field bertipe ordered_select (Dropdown Berurutan),
    // plus jumlah pemakaian (untuk peringatan sebelum hapus opsi).
    // Hitung pemakaian di PHP (bukan subquery SQL) agar tidak terpengaruh
    // perbedaan collation antar tabel.
    $usedCounts = [];
    foreach (db()->query("SELECT field_id, value FROM employee_biodata
                          WHERE field_id IN (SELECT id FROM biodata_fields WHERE field_type = 'ordered_select')
                            AND value IS NOT NULL AND value <> ''")->fetchAll() as $r) {
        $key = $r['field_id'] . ':' . (string)(int)$r['value'];
        $usedCounts[$key] = ($usedCounts[$key] ?? 0) + 1;
    }

    $optionsByField = [];
    $stmt = db()->query('SELECT id, field_id, label, urutan FROM biodata_field_options
                         ORDER BY field_id ASC, urutan ASC, id ASC');
    foreach ($stmt->fetchAll() as $o) {
        $key = $o['field_id'] . ':' . (int)$o['id'];
        $optionsByField[(int)$o['field_id']][] = [
            'id'         => (int)$o['id'],
            'label'      => $o['label'],
            'urutan'     => (int)$o['urutan'],
            'used_count' => $usedCounts[$key] ?? 0,
        ];
    }

    foreach ($rows as &$row) {
        if ($row['field_type'] === 'ordered_select') {
            $row['options'] = $optionsByField[(int)$row['id']] ?? [];
        } else {
            $decoded = json_decode((string)$row['options'], true);
            $row['options'] = is_array($decoded) ? array_values($decoded) : [];
        }
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
    // ordered_select: opsinya dikelola di tabel biodata_field_options (lihat sync_ordered_options).

    return ['label' => $label, 'field_type' => $type, 'options' => $options];
}

function backfill_field(int $fieldId): void
{
    // Sedikan baris kosong utk semua personel yang sudah ada,
    // agar field langsung "muncul" untuk semua data.
    db()->prepare('INSERT IGNORE INTO employee_biodata (employee_id, field_id, value)
                   SELECT id, ?, NULL FROM employees')->execute([$fieldId]);
}

/**
 * Sinkronkan daftar opsi hierarki sebuah field ordered_select.
 * $incoming: array berurutan sesuai hierarki baru, tiap item {id?: int, label: string}.
 *  - Opsi dengan id yang ada  -> label & urutan diperbarui (identitas tetap, nilai karyawan aman).
 *  - Opsi tanpa id / id baru  -> disisipkan pada posisi tersebut.
 *  - Opsi lama yang tidak ada di daftar -> DIHAPUS (nilai karyawan yang memakai opsi itu
 *    menjadi tak terpetakan & ditandai "perlu diisi ulang" di UI).
 */
function sync_ordered_options(PDO $pdo, int $fieldId, array $incoming): void
{
    $incoming = array_values($incoming);

    $labelsSeen = [];
    foreach ($incoming as $opt) {
        $label = clean_text($opt['label'] ?? '', 255);
        if ($label === '') {
            json_error('Label opsi tidak boleh kosong.');
        }
        $key = mb_strtolower($label);
        if (isset($labelsSeen[$key])) {
            json_error("Label opsi \"$label\" tidak boleh duplikat.");
        }
        $labelsSeen[$key] = true;
    }

    $existing = [];
    $stmt = $pdo->prepare('SELECT id FROM biodata_field_options WHERE field_id = ?');
    $stmt->execute([$fieldId]);
    foreach ($stmt->fetchAll() as $o) {
        $existing[(int)$o['id']] = true;
    }

    $update = $pdo->prepare('UPDATE biodata_field_options SET label = ?, urutan = ? WHERE id = ? AND field_id = ?');
    $insert = $pdo->prepare('INSERT INTO biodata_field_options (field_id, label, urutan) VALUES (?, ?, ?)');

    $keepIds = [];
    foreach ($incoming as $index => $opt) {
        $label = clean_text($opt['label'] ?? '', 255);
        $id = (int)($opt['id'] ?? 0);
        if ($id > 0 && isset($existing[$id])) {
            $update->execute([$label, $index, $id, $fieldId]);
            $keepIds[] = $id;
        } else {
            $insert->execute([$fieldId, $label, $index]);
            $keepIds[] = (int)$pdo->lastInsertId();
        }
    }

    if (count($keepIds) === 0) {
        $pdo->prepare('DELETE FROM biodata_field_options WHERE field_id = ?')->execute([$fieldId]);
        return;
    }
    $placeholders = implode(',', array_fill(0, count($keepIds), '?'));
    $delete = $pdo->prepare("DELETE FROM biodata_field_options WHERE field_id = ? AND id NOT IN ($placeholders)");
    $delete->execute([...[$fieldId], ...$keepIds]);
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
    $id = (int)$pdo->lastInsertId();

    if ($field['field_type'] === 'ordered_select') {
        $incoming = body()['options'] ?? [];
        sync_ordered_options($pdo, $id, is_array($incoming) ? $incoming : []);
    }

    backfill_field($id);
    json_response(fields_list(), 201);
}

function fields_update(int $id): void
{
    $field = validate_field(body());
    $pdo = db();
    $check = $pdo->prepare('SELECT field_type FROM biodata_fields WHERE id = ?');
    $check->execute([$id]);
    $current = $check->fetch();
    if (!$current) {
        json_error('Field tidak ditemukan.', 404);
    }

    // Berganti DARI ordered_select ke tipe lain: nilai yang menunjuk ke opsi
    // yang masih ada dikonversi jadi label teks agar data tetap terbaca;
    // nilai yang menunjuk ke opsi yang sudah terhapus dikosongkan (NULL).
    if ($current['field_type'] === 'ordered_select' && $field['field_type'] !== 'ordered_select') {
        $pdo->prepare("UPDATE employee_biodata eb
                       LEFT JOIN biodata_field_options o ON o.field_id = eb.field_id AND o.id = eb.value
                       SET eb.value = NULL
                       WHERE eb.field_id = ? AND eb.value IS NOT NULL AND eb.value <> '' AND o.id IS NULL")->execute([$id]);
        $pdo->prepare('UPDATE employee_biodata eb
                       JOIN biodata_field_options o ON o.field_id = eb.field_id AND o.id = eb.value
                       SET eb.value = o.label
                       WHERE eb.field_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM biodata_field_options WHERE field_id = ?')->execute([$id]);
    }

    $stmt = $pdo->prepare('UPDATE biodata_fields
                           SET label = ?, field_type = ?, options = ?
                           WHERE id = ?');
    $stmt->execute([
        $field['label'],
        $field['field_type'],
        $field['options'] ? json_encode($field['options'], JSON_UNESCAPED_UNICODE) : null,
        $id,
    ]);

    if ($field['field_type'] === 'ordered_select') {
        $incoming = body()['options'] ?? [];
        sync_ordered_options($pdo, $id, is_array($incoming) ? $incoming : []);
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
    // biodata_field_options ikut terhapus lewat FK ON DELETE CASCADE.
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
