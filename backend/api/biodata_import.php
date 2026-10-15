<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/docparse.php';

// ============================================================
// Fitur "Isi Biodata dari File (AI)" — generalisasi dari
// "Isi Pangkat dari File (AI)" ke SEMUA kolom biodata.
// Alur: upload file (.xlsx/.xls/.csv/.docx diparse di browser,
// .doc diparse di sini) → admin petakan tiap kolom Excel ke
// Nama Lengkap (kunci pencocokan) atau kolom biodata apa pun →
// /biodata-import/match mencocokkan nama (fuzzy lokal, tanpa LLM)
// + mendeteksi konflik dengan data yang sudah ada → admin
// memutuskan di layar preview → /biodata-import/apply menyimpan
// dalam satu transaksi.
// Prinsip PRD: tidak pernah menebak sendiri untuk kasus ragu,
// tidak pernah menimpa data tanpa persetujuan admin.
// ============================================================

const BI_MAX_UPLOAD = 10 * 1024 * 1024; // 10 MB

// Ambang pencocokan: nama auto-match minimal skor 92/100 dan selisih ≥ 3
// dari kandidat kedua; opsi Dropdown Berurutan auto-match hanya bila
// identik setelah normalisasi (kapital/spasi/tanda baca/NRP diabaikan).
const BI_AUTO_THRESHOLD = 92;
const BI_AMBIGUOUS_GAP = 3;

/**
 * POST /api/biodata-import/parse  (multipart/form-data, field `file`)
 * File .doc (Word binary) diparse di sini. Format lain dikembalikan
 * apa adanya (diparse di browser) supaya frontend bisa lanjut.
 */
function biodata_parse_upload(): void
{
    if (!isset($_FILES['file'])) {
        json_error('Tidak ada file yang diupload.');
    }
    $f = $_FILES['file'];
    $code = (int)($f['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($code !== UPLOAD_ERR_OK) {
        json_error($code === UPLOAD_ERR_INI_SIZE
            ? 'File terlalu besar untuk limit upload PHP. Simpan ulang sebagai .xlsx (lebih kecil) atau naikkan upload_max_filesize.'
            : 'Upload gagal (kode ' . $code . ').');
    }
    if (($f['size'] ?? 0) <= 0 || $f['size'] > BI_MAX_UPLOAD) {
        json_error('Ukuran file maksimal 10 MB.');
    }
    $name = (string)($f['name'] ?? '');
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    $binary = (string)file_get_contents($f['tmp_name']);

    if ($ext === 'doc' || ($ext === '' && substr($binary, 0, 8) === "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1")) {
        $parsed = doc_extract_rows($binary);
        json_response([
            'kind' => 'doc',
            'headers' => $parsed['headers'],
            'rows' => $parsed['rows'],
            'file_name' => $name,
            'note' => 'File Word (.doc) berhasil dibaca. Periksa pemetaan kolom di langkah berikutnya.',
        ]);
    }

    // .xlsx / .xls / .csv / .docx → diparse di browser (SheetJS / fflate).
    json_response([
        'kind' => 'browser',
        'file_name' => $name,
        'note' => 'File ini diparse di browser.',
    ]);
}

// ------------------------------------------------------------
// Normalisasi & fuzzy matching (lokal, tanpa LLM)
// ------------------------------------------------------------

/** Daftar gelar/atribut yang dilepas sebelum pencocokan nama. */
const BI_TITLES = [
    'dr.', 'dr', 'drh.', 'drh', 'ir.', 'ir', 'prof.', 'prof',
    'h.', 'hj.', 'h', 'hj', 'r.', 'r',
    's.h.', 's.h', 'sh.', 'sh', 'm.h.', 'm.h', 'mh.', 'mh',
    's.i.k.', 's.i.k', 'sik.', 'sik', 's.s.i.', 's.s.i', 'ssi.', 'ssi',
    'm.s.i.', 'm.s.i', 'msi.', 'msi', 'm.krim.', 'm.krim', 'mkrim.', 'mkrim',
    'm.m.', 'm.m', 'mm.', 'mm', 'm.han.', 'm.han', 'mhan.', 'mhan',
    's.sos.', 's.sos', 'ssos.', 'ssos', 's.ap.', 's.ap', 'sap.', 'sap',
    's.kom.', 's.kom', 'm.kom.', 'm.kom', 's.e.', 's.e', 'se.', 'se',
    'm.si.', 'm.si', 'msi.', 'msi', 'bba', 'bba.', 'an.', 'an',
    'k.', 'k', 'm.', 'm', 'p.', 'p', 'u.j.', 'u.j',
];

/** Buang gelar, pangkat di depan (contoh: "AKP BUDI"), dan normalisasi spasi. */
function bi_normalize_name(string $raw): string
{
    $s = mb_strtolower(trim($raw));
    $s = str_replace('.', '. ', $s);          // "a.b." → "a. b. " agar gelar utuh
    $s = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $s) ?? ' ';
    $words = preg_split('/\s+/u', $s, -1, PREG_SPLIT_NO_EMPTY) ?: [];

    $titles = [];
    foreach (BI_TITLES as $t) {
        $titles[str_replace('. ', '.', $t)] = true; // kunci versi tanpa spasi: "s.h"
    }
    // Buang gelar di AWAL dan AKHIR berulang-ulang.
    while ($words !== []) {
        $first = rtrim($words[0], '.');
        $last = rtrim(end($words), '.');
        if (isset($titles[$first])) {
            array_shift($words);
        } elseif (isset($titles[$last])) {
            array_pop($words);
        } else {
            break;
        }
    }
    return implode(' ', $words);
}

/** Similarity 0..100 antara dua nama yang sudah dinormalisasi. */
function bi_name_similarity(string $a, string $b): int
{
    if ($a === '' || $b === '') {
        return 0;
    }
    if ($a === $b) {
        return 100;
    }
    similar_text($a, $b, $pct1);
    $len = max(mb_strlen($a), mb_strlen($b));
    $pct2 = $len > 0 ? (1 - levenshtein($a, $b) / $len) * 100 : 0;
    $score = max($pct1, $pct2);

    // Bonus jika satu nama adalah subset token yang sama
    // (contoh: "ahmad s" ⊂ "ahmad sahrul"); token pendek juga dianggap
    // cocok bila merupakan awalan token di nama lain (inisial gelar/pendekan).
    $ta = explode(' ', $a);
    $tb = explode(' ', $b);
    $sb = array_fill_keys($tb, true);
    $inter = 0;
    foreach ($ta as $w) {
        if (isset($sb[$w])) {
            $inter++;
            continue;
        }
        if (mb_strlen($w) <= 3) {
            foreach ($tb as $w2) {
                if (str_starts_with($w2, $w)) {
                    $inter++;
                    break;
                }
            }
        }
    }
    $smaller = min(count($ta), count($tb));
    if ($smaller > 0 && $inter === $smaller) {
        $score = max($score, ($inter / max(count($ta), count($tb))) * 100);
    }
    return (int)round(min(100, $score));
}

/* fungsi lama dihapus */
/**
 * Pencocokan nama lokal: kembalikan daftar kandidat terbaik.
 *  - 1 kandidat ≥ AUTO_THRESHOLD dan < AMBIGUOUS_GAP dari nomor 2 → auto.
 *  - selain itu → perlu konfirmasi (dengan kandidat, atau kosong).
 */
function bi_match_name(string $excelName, array $employees): array
{
    $norm = bi_normalize_name($excelName);
    if ($norm === '') {
        return ['matched_id' => null, 'status' => 'manual', 'candidates' => []];
    }

    $scored = [];
    foreach ($employees as $emp) {
        $score = bi_name_similarity($norm, $emp['norm']);
        if ($score >= 60) {
            $scored[] = ['id' => (int)$emp['id'], 'nama' => $emp['nama'], 'score' => $score];
        }
    }
    usort($scored, static fn($x, $y) => $y['score'] <=> $x['score']);
    $scored = array_slice($scored, 0, 5);

    if ($scored !== [] && $scored[0]['score'] >= BI_AUTO_THRESHOLD
        && (count($scored) < 2 || $scored[0]['score'] - $scored[1]['score'] >= BI_AMBIGUOUS_GAP)) {
        return ['matched_id' => $scored[0]['id'], 'status' => 'auto', 'candidates' => $scored];
    }
    return ['matched_id' => null, 'status' => 'manual', 'candidates' => $scored];
}

/**
 * Kunci perbandingan label opsi: huruf besar, tanpa angka (NRP) & tanda baca,
 * spasi dihilangkan. Dua varian: dengan kata sambungan (POL, POLRI, …) yang
 * masih menempel utuh dan tanpa — supaya "KOMBES POL" ≡ "KOMBESPOL" ≡ "KOMBES".
 */
function bi_option_keys(string $raw): array
{
    $s = mb_strtoupper(trim($raw));
    $s = str_replace('.', '. ', $s);
    $s = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $s) ?? ' ';
    $words = preg_split('/\s+/u', $s, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $stop = ['POLRI', 'POL', 'NRPK', 'NRP'];
    $kept = array_values(array_filter($words, static fn($w) => !preg_match('/\d/', $w)));
    $all = implode('', $kept);
    $noStop = implode('', array_values(array_filter($kept, static fn($w) => !in_array($w, $stop, true))));
    return array_values(array_filter([$all, $noStop], static fn($k) => $k !== ''));
}

/**
 * Pencocokan nilai Excel ke opsi sebuah field Dropdown Berurutan.
 * Auto HANYA bila identik setelah normalisasi (kapital/spasi/tanda baca/
 * NRP/kata sambungan diabaikan); sisanya WAJIB konfirmasi admin
 * (PRD Section 5) — termasuk kemungkinan opsi baru.
 */
function bi_match_option(string $excelValue, array $options): array
{
    $excelKeys = bi_option_keys($excelValue);
    if ($excelKeys === []) {
        return ['option_id' => null, 'status' => 'manual', 'best' => null];
    }
    $primary = $excelKeys[0];
    $best = null;
    $bestScore = 0;
    foreach ($options as $opt) {
        if (array_intersect($excelKeys, bi_option_keys($opt['label'])) !== []) {
            return ['option_id' => (int)$opt['id'], 'status' => 'auto', 'best' => ['id' => (int)$opt['id'], 'label' => $opt['label'], 'score' => 100]];
        }
        similar_text($primary, bi_option_keys($opt['label'])[0] ?? '', $pct);
        if ($pct > $bestScore) {
            $bestScore = $pct;
            $best = ['id' => (int)$opt['id'], 'label' => $opt['label'], 'score' => (int)round($pct)];
        }
    }
    return ['option_id' => null, 'status' => 'manual', 'best' => $best];
}

/**
 * Parse teks tanggal dari Excel ke Y-m-d (konvensi Indonesia: hari dulu).
 * Return null bila tidak bisa diparse.
 */
function bi_parse_date(string $raw): ?string
{
    $v = trim($raw);
    if ($v === '') {
        return null;
    }
    $dt = DateTime::createFromFormat('Y-m-d', $v);
    if ($dt && $dt->format('Y-m-d') === $v) {
        return $v;
    }
    // d/m/Y, m/d/Y, d-m-Y, m-d-Y, d.m.Y — deteksi otomatis dari posisi angka > 12.
    if (preg_match('#^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$#', $v, $m)) {
        $a = (int)$m[1];
        $b = (int)$m[2];
        $y = (int)$m[3];
        if ($y < 100) {
            $y += $y < 70 ? 2000 : 1900;
        }
        if ($a > 12 && $b <= 12) {          // pasti hari-bulan
            [$d, $mo] = [$a, $b];
        } elseif ($b > 12 && $a <= 12) {    // pasti bulan-hari
            [$d, $mo] = [$b, $a];
        } else {                            // ambigu → konvensi Indonesia: hari dulu
            [$d, $mo] = [$a, $b];
        }
        if (checkdate($mo, $d, $y)) {
            return sprintf('%04d-%02d-%02d', $y, $mo, $d);
        }
    }
    // Serial date Excel (angka murni) — epoch 1899-12-30.
    if (preg_match('/^\d{1,6}(?:\.\d+)?$/', $v)) {
        $serial = (float)$v;
        if ($serial > 1 && $serial < 100000) {
            try {
                $dt = new DateTime('1899-12-30');
                $dt->modify('+' . (int)floor($serial) . ' days');
                return $dt->format('Y-m-d');
            } catch (Throwable) {
                return null;
            }
        }
    }
    return null;
}

/** Opsi hierarki sebuah field ordered_select, urut sesuai hierarki. */
function bi_field_options(int $fieldId): array
{
    $opts = db()->prepare('SELECT id, label, urutan FROM biodata_field_options
                           WHERE field_id = ? ORDER BY urutan ASC, id ASC');
    $opts->execute([$fieldId]);
    return array_map(static fn($o) => [
        'id' => (int)$o['id'],
        'label' => $o['label'],
        'urutan' => (int)$o['urutan'],
    ], $opts->fetchAll());
}

/**
 * POST /api/biodata-import/match
 * Body: { file_name, headers: [], rows: [[...]], name_col: int,
 *         mappings: { colIndexExcel: fieldIdBiodata } }
 * Return hasil pencocokan nama + status per kolom yang dipetakan
 * (empty | match | conflict | unmapped) untuk layar preview.
 */
function biodata_match(): void
{
    $body = body();
    $rows = $body['rows'] ?? [];
    $nameCol = (int)($body['name_col'] ?? -1);
    $mappings = $body['mappings'] ?? [];

    if (!is_array($rows) || $rows === []) {
        json_error('Data baris kosong — tidak ada yang bisa dicocokkan.');
    }
    if ($nameCol < 0) {
        json_error('Pilih dulu kolom Nama Lengkap (kunci pencocokan).');
    }
    if (!is_array($mappings) || $mappings === []) {
        json_error('Petakan minimal satu kolom biodata untuk diisi.');
    }

    // Validasi pemetaan: field harus ada, satu field hanya boleh dari satu kolom.
    $fieldMap = [];
    foreach (db()->query('SELECT id, label, field_type, options FROM biodata_fields
                          ORDER BY urutan ASC, id ASC')->fetchAll() as $f) {
        $fieldMap[(int)$f['id']] = $f;
    }
    $targets = []; // colIndexExcel => fieldId
    $seen = [];
    foreach ($mappings as $colIdx => $fid) {
        $ci = (int)$colIdx;
        $fid = (int)$fid;
        if ($ci < 0 || $ci === $nameCol || $fid <= 0 || !isset($fieldMap[$fid])) {
            continue; // mapping tidak valid → diabaikan (UI mencegahnya)
        }
        if (isset($seen[$fid])) {
            json_error('Kolom biodata yang sama dipetakan dari lebih dari satu kolom Excel. Perbaiki pemetaan.', 422);
        }
        $seen[$fid] = true;
        $targets[$ci] = $fid;
    }
    if ($targets === []) {
        json_error('Petakan minimal satu kolom biodata untuk diisi.');
    }

    // Opsi per field ordered_select (sekali, bukan per baris).
    $optionsByField = [];
    foreach ($fieldMap as $fid => $f) {
        if ($f['field_type'] === 'ordered_select') {
            $optionsByField[$fid] = bi_field_options($fid);
        }
    }

    // Muat seluruh personel + biodata existing (batch, bukan per baris SQL).
    $employees = [];
    foreach (db()->query('SELECT id, nama_lengkap FROM employees ORDER BY id ASC')->fetchAll() as $e) {
        $employees[(int)$e['id']] = [
            'id' => (int)$e['id'],
            'nama' => $e['nama_lengkap'],
            'norm' => bi_normalize_name($e['nama_lengkap']),
        ];
    }
    $bioMap = []; // "employeeId|fieldId" => value
    if ($employees !== []) {
        foreach (db()->query('SELECT employee_id, field_id, value FROM employee_biodata')->fetchAll() as $r) {
            $bioMap[(int)$r['employee_id'] . '|' . (int)$r['field_id']] = (string)$r['value'];
        }
    }

    $optLabel = [];
    foreach ($optionsByField as $fid => $opts) {
        foreach ($opts as $o) {
            $optLabel[$fid . ':' . $o['id']] = $o['label'];
        }
    }

    $out = [];
    foreach (array_values($rows) as $i => $row) {
        $row = is_array($row) ? $row : [];
        $excelName = clean_text($row[$nameCol] ?? '', 255);

        if (bi_normalize_name($excelName) === '') {
            continue; // baris tanpa nama → diabaikan total
        }

        $nameMatch = bi_match_name($excelName, array_values($employees));
        if ($nameMatch['matched_id'] !== null) {
            $nameStatus = 'auto';
        } elseif ($nameMatch['candidates'] !== []) {
            $nameStatus = 'manual';
        } else {
            $nameStatus = 'not_found';
        }
        $emp = null;
        if ($nameMatch['matched_id'] !== null) {
            $e = $employees[(int)$nameMatch['matched_id']];
            $emp = ['id' => $e['id'], 'nama' => $e['nama']];
        }

        // Status per kolom yang dipetakan (baris not_found tidak perlu sel —
        // seluruh barisnya dilewati otomatis).
        $cells = [];
        if ($nameStatus !== 'not_found') {
            foreach ($targets as $ci => $fid) {
            $f = $fieldMap[$fid];
            $excelVal = clean_text($row[$ci] ?? '', 65535);
            $curVal = $emp !== null ? ($bioMap[$emp['id'] . '|' . $fid] ?? '') : '';
            $cell = [
                'field_id' => $fid,
                'field_label' => $f['label'],
                'field_type' => $f['field_type'],
                'excel_value' => $excelVal,
                'current_value' => $curVal,   // nilai mentah di sistem (id opsi utk ordered_select)
                'current_label' => $curVal,   // label tampilan (label opsi utk ordered_select)
                'status' => 'empty',   // empty | match | conflict | unmapped
                'option_id' => null,
                'best' => null,
            ];
            if ($excelVal === '') {
                $cell['status'] = 'empty'; // kolom Excel kosong → tidak mengubah apa pun
            } elseif ($f['field_type'] === 'ordered_select') {
                $cell['current_label'] = $optLabel[$fid . ':' . $curVal] ?? '';
                $m = bi_match_option($excelVal, $optionsByField[$fid]);
                if ($m['status'] === 'auto') {
                    $cell['option_id'] = $m['option_id'];
                    $cell['status'] = ((string)$curVal === (string)$m['option_id']) ? 'match'
                        : ($curVal === '' ? 'fill' : 'conflict');
                } else {
                    $cell['status'] = 'unmapped'; // tidak pernah menebak (PRD)
                    $cell['best'] = $m['best'];
                }
            } elseif ($f['field_type'] === 'date') {
                $parsed = bi_parse_date($excelVal);
                $cell['excel_iso'] = $parsed;
                if ($parsed === null) {
                    $cell['status'] = 'invalid'; // tidak bisa diparse sebagai tanggal
                } elseif ($curVal === '') {
                    $cell['status'] = 'fill';
                } else {
                    $cell['status'] = ($parsed === $curVal) ? 'match' : 'conflict';
                }
            } else {
                $cell['status'] = $curVal === '' ? 'fill' : (($curVal === $excelVal) ? 'match' : 'conflict');
            }
            $cells[] = $cell;
            }
        }

        // Nilai existing tiap kandidat nama — dipakai frontend untuk menghitung
        // ulang status konflik saat admin memilih kandidat lain secara manual.
        $candValues = [];
        foreach ($nameMatch['candidates'] as $cand) {
            $cv = [];
            foreach ($targets as $cid => $cfid) {
                $cv[$cfid] = $bioMap[$cand['id'] . '|' . $cfid] ?? '';
            }
            $candValues[(int)$cand['id']] = $cv;
        }

        // Status gabungan baris: not_found > confirm_name > confirm_cells > ok.
        $needsDecision = false;
        foreach ($cells as $c) {
            if (in_array($c['status'], ['conflict', 'unmapped', 'invalid'], true)) {
                $needsDecision = true;
                break;
            }
        }
        $status = $nameStatus === 'not_found' ? 'not_found'
            : ($nameStatus === 'manual' ? 'confirm_name'
            : ($needsDecision ? 'confirm_cells' : 'ok'));

        $out[] = [
            'row_index' => $i,
            'excel_name' => $excelName,
            'employee' => $emp,
            'candidates' => $nameMatch['candidates'],
            'name_status' => $nameStatus,
            'candidate_values' => $candValues,
            'cells' => $cells,
            'status' => $status,
        ];
    }

    $fieldsOut = [];
    foreach ($fieldMap as $fid => $f) {
        $fieldsOut[] = [
            'id' => $fid,
            'label' => $f['label'],
            'field_type' => $f['field_type'],
            'options' => $f['field_type'] === 'ordered_select' ? $optionsByField[$fid] : [],
        ];
    }

    json_response([
        'fields' => $fieldsOut,
        'employees_count' => count($employees),
        'results' => $out,
    ]);
}

/**
 * POST /api/biodata-import/apply
 * Body: {
 *   rows: [ { employee_id, cells: [ { field_id, action: 'set'|'keep'|'new_option',
 *                                    value?, new_option_label? } ] } ]
 * } → satu transaksi: opsi baru dibuat di akhir hierarki field masing-masing,
 * lalu nilai employee_biodata di-upsert. 'keep' berarti konflik dipertahankan.
 */
function biodata_apply(): void
{
    $body = body();
    $rows = $body['rows'] ?? [];
    if (!is_array($rows) || $rows === []) {
        json_error('Tidak ada data untuk diterapkan.');
    }

    $pdo = db();

    // Kumpulkan semua field yang disentuh + validasi tipenya.
    $fieldIds = [];
    foreach ($rows as $r) {
        if (!is_array($r)) {
            continue;
        }
        foreach (($r['cells'] ?? []) as $c) {
            if (is_array($c) && (int)($c['field_id'] ?? 0) > 0) {
                $fieldIds[(int)$c['field_id']] = true;
            }
        }
    }
    if ($fieldIds === []) {
        json_error('Tidak ada kolom biodata yang akan diisi.');
    }
    $fields = [];
    $in = implode(',', array_fill(0, count($fieldIds), '?'));
    $st = $pdo->prepare("SELECT id, label, field_type, options FROM biodata_fields WHERE id IN ($in)");
    $st->execute(array_keys($fieldIds));
    foreach ($st->fetchAll() as $f) {
        $fields[(int)$f['id']] = $f;
    }
    if (count($fields) !== count($fieldIds)) {
        json_error('Ada kolom biodata yang sudah dihapus — muat ulang halaman dan ulangi proses.', 422);
    }

    // Opsi valid per field ordered_select (untuk 'set' & 'new_option').
    $optionsByField = [];
    foreach ($fields as $fid => $f) {
        if ($f['field_type'] === 'ordered_select') {
            $optionsByField[$fid] = bi_field_options($fid);
        }
    }

    try {
        $pdo->beginTransaction();

        // Kunci baris field agar tidak berubah selama proses (juga mencegah
        // dua import berjalan bersamaan).
        $st = $pdo->prepare("SELECT id FROM biodata_fields WHERE id IN ($in) FOR UPDATE");
        $st->execute(array_keys($fieldIds));

        // Opsi baru per field, urut kemunculan → dimasukkan di akhir hierarki.
        $maxUrutan = [];
        $labelToId = [];
        foreach ($optionsByField as $fid => $opts) {
            $st = $pdo->prepare('SELECT COALESCE(MAX(urutan), -1) FROM biodata_field_options WHERE field_id = ?');
            $st->execute([$fid]);
            $maxUrutan[$fid] = (int)$st->fetchColumn();
            $labelToId[$fid] = [];
            foreach ($opts as $o) {
                $labelToId[$fid][mb_strtolower(trim($o['label']))] = (int)$o['id'];
            }
        }

        $newOptions = [];   // "fid|labelLower" => label (urut kemunculan)
        $writes = [];       // penulisan tertunda: [employeeId, fieldId, value ('NEW:key' = opsi baru)]
        $insertOpt = $pdo->prepare('INSERT INTO biodata_field_options (field_id, label, urutan) VALUES (?, ?, ?)');

        $existsEmp = $pdo->prepare('SELECT id FROM employees WHERE id = ?');
        $upsert = $pdo->prepare('INSERT INTO employee_biodata (employee_id, field_id, value) VALUES (?, ?, ?)
                                 ON DUPLICATE KEY UPDATE value = VALUES(value)');

        $filled = 0;        // kolom sebelumnya kosong → terisi
        $updated = 0;       // konflik ditimpa
        $kept = 0;          // konflik dipertahankan
        $invalidCells = 0;  // nilai tidak valid (mis. opsi sudah dihapus) → dilewati
        $skippedRows = 0;
        $appliedRowIds = []; // personel yang benar-benar diproses (bukan sekadar diterima)
        $failedRowIds = [];  // personel dengan minimal satu sel gagal disimpan

        foreach (array_values($rows) as $r) {
            if (!is_array($r)) {
                continue;
            }
            $empId = (int)($r['employee_id'] ?? 0);
            if ($empId <= 0) {
                $skippedRows++;
                continue;
            }
            $existsEmp->execute([$empId]);
            if ($existsEmp->fetch() === false) {
                $skippedRows++; // personel sudah dihapus antara preview dan apply
                continue;
            }

            // Nilai existing untuk seluruh field yang disentuh baris ini (sekali).
            $curValues = [];
            $fids = [];
            foreach (($r['cells'] ?? []) as $c) {
                if (is_array($c) && (int)($c['field_id'] ?? 0) > 0) {
                    $fids[(int)$c['field_id']] = true;
                }
            }
            if ($fids !== []) {
                $ph = implode(',', array_fill(0, count($fids), '?'));
                $st = $pdo->prepare("SELECT field_id, value FROM employee_biodata
                                     WHERE employee_id = ? AND field_id IN ($ph)");
                $st->execute(array_merge([$empId], array_keys($fids)));
                foreach ($st->fetchAll() as $row) {
                    $curValues[(int)$row['field_id']] = (string)$row['value'];
                }
            }
            $appliedRowIds[] = $empId;
            $invalidBeforeRow = $invalidCells;

            foreach (($r['cells'] ?? []) as $c) {
                if (!is_array($c)) {
                    continue;
                }
                $fid = (int)($c['field_id'] ?? 0);
                if (!isset($fields[$fid])) {
                    $invalidCells++;
                    continue;
                }
                $action = (string)($c['action'] ?? '');
                if ($action === 'keep') {
                    $kept++; // konflik dipertahankan (nilai lama tidak diubah)
                    continue;
                }

                $type = $fields[$fid]['field_type'];
                $newValue = null;

                if ($action === 'new_option') {
                    if ($type !== 'ordered_select') {
                        $invalidCells++;
                        continue;
                    }
                    $label = clean_text($c['new_option_label'] ?? '', 255);
                    if ($label === '') {
                        $invalidCells++;
                        continue;
                    }
                    $key = mb_strtolower($label);
                    if (!isset($labelToId[$fid][$key]) && !isset($newOptions[$fid . '|' . $key])) {
                        $newOptions[$fid . '|' . $key] = $label;
                    }
                    $newValue = 'NEW:' . $key; // di-resolve setelah opsi dibuat
                } elseif ($action === 'set') {
                    $value = (string)($c['value'] ?? '');
                    switch ($type) {
                        case 'ordered_select':
                            $optId = (int)$value;
                            $valid = false;
                            foreach ($optionsByField[$fid] as $o) {
                                if ($o['id'] === $optId) {
                                    $valid = true;
                                    break;
                                }
                            }
                            if (!$valid) {
                                $invalidCells++; // opsi sudah dihapus antara preview dan apply
                                continue 2;
                            }
                            $newValue = (string)$optId;
                            break;
                        case 'dropdown':
                            $options = json_decode((string)$fields[$fid]['options'], true) ?: [];
                            if (!in_array($value, $options, true)) {
                                $invalidCells++;
                                continue 2;
                            }
                            $newValue = $value;
                            break;
                        case 'date':
                            $iso = bi_parse_date($value);
                            if ($iso === null) {
                                $invalidCells++;
                                continue 2;
                            }
                            $newValue = $iso;
                            break;
                        case 'number':
                            if (!is_numeric($value)) {
                                $invalidCells++;
                                continue 2;
                            }
                            $newValue = $value;
                            break;
                        default:
                            $newValue = mb_strlen($value) > 65535 ? mb_substr($value, 0, 65535) : $value;
                    }
                } else {
                    $invalidCells++;
                    continue;
                }

                $cur = $curValues[$fid] ?? '';
                if ($newValue !== '' && $newValue === $cur) {
                    $kept++; // sudah sesuai (tidak berubah)
                    continue;
                }
                if ($cur === '' && $newValue !== '') {
                    $filled++;
                } elseif ($newValue !== '') {
                    $updated++;
                }
                $writes[] = [$empId, $fid, $newValue];
            }

            if ($invalidCells > $invalidBeforeRow) {
                $failedRowIds[] = $empId; // ada sel gagal di baris ini
            }
        }

        // Buat opsi baru di akhir hierarki (PRD Langkah 4), urut kemunculan,
        // lalu selesaikan seluruh penulisan tertunda (termasuk nilai "NEW:...").
        $newOptionRows = [];
        foreach ($newOptions as $key => $label) {
            [$fid, $labelLower] = explode('|', $key, 2);
            $fid = (int)$fid;
            $insertOpt->execute([$fid, $label, ++$maxUrutan[$fid]]);
            $id = (int)$pdo->lastInsertId();
            $labelToId[$fid][$labelLower] = $id;
            $newOptions[$key] = $id; // map berubah: labelKey => id opsi final
            $newOptionRows[] = ['id' => $id, 'field_id' => $fid, 'field_label' => $fields[$fid]['label'], 'label' => $label];
        }

        $writtenCells = 0; // jumlah operasi tulis NYATA ke employee_biodata
        foreach ($writes as [$empId, $fid, $value]) {
            if (str_starts_with((string)$value, 'NEW:')) {
                $id = $newOptions[$fid . '|' . substr((string)$value, 4)] ?? 0;
                if ($id <= 0) {
                    $invalidCells++;
                    $failedRowIds[] = $empId;
                    continue;
                }
                $value = (string)$id;
            }
            $upsert->execute([$empId, $fid, (string)$value]);
            if ($upsert->rowCount() === 0) {
                // Tidak boleh gagal diam-diam (PRD Section 4) — gagalkan transaksi.
                throw new RuntimeException("Gagal menulis biodata personel #{$empId} (field #{$fid}).");
            }
            $writtenCells++;
        }

        $pdo->commit();

        // Ringkasan WAJIB mencerminkan operasi nyata di database (PRD Section 4):
        // applied_rows = baris yang benar-benar diproses (bukan sekadar diterima),
        // failed_rows  = baris dengan minimal satu sel yang gagal disimpan.
        json_response([
            'ok' => true,
            'applied_rows' => count($appliedRowIds),
            'written_cells' => $writtenCells,
            'failed_rows' => count(array_unique($failedRowIds)),
            'filled' => $filled,
            'updated' => $updated,
            'kept' => $kept,
            'invalid_cells' => $invalidCells,
            'skipped_rows' => $skippedRows,
            'new_options' => $newOptionRows,
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        json_error('Gagal menerapkan data: ' . $e->getMessage(), 500);
    }
}
