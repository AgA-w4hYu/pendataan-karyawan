<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

// ============================================================
// Parser dokumen Word biner lama (.doc, Word 97-2003) — tanpa
// dependensi eksternal. Cukup untuk mengekstrak ISI TABEL:
//   CFB (Compound File Binary) → stream WordDocument + 1Table/0Table
//   → piece table (CLX) → teks → baris-baris tabel.
// Dipakai fitur "Isi Pangkat dari Excel (AI)" untuk file .doc.
// ============================================================

const CFB_ENDOFCHAIN = 0xFFFFFFFE;
const CFB_DIFSECT    = 0xFFFFFFFC;

function cfb_u16(string $b, int $o): int
{
    return unpack('v', substr($b, $o, 2))[1];
}

function cfb_u32(string $b, int $o): int
{
    return unpack('V', substr($b, $o, 4))[1];
}

function cfb_u64(string $b, int $o): int
{
    return unpack('P', substr($b, $o, 8))[1];
}

/**
 * Baca isi sebuah stream dari file CFB (mis. 'WordDocument' atau '1Table').
 * Mendukung stream normal (rantai FAT) dan mini-stream (< cutoff, rantai MiniFAT
 * yang disimpan di stream Root Entry).
 */
function cfb_read_stream(string $data, string $name): ?string
{
    if (strlen($data) < 512 || substr($data, 0, 8) !== "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1") {
        return null;
    }
    $ssz = 1 << cfb_u16($data, 30);            // ukuran sektor (512 atau 4096)
    $miniCutoff = cfb_u16($data, 56) ?: 4096;
    $nFat = cfb_u32($data, 44);
    $dirStart = cfb_u32($data, 48);
    $miniFatStart = cfb_u32($data, 60);

    // DIFAT: 109 entri di header + rantai sektor DIFAT lanjutan.
    $difat = [];
    for ($i = 0; $i < 109; $i++) {
        $s = cfb_u32($data, 76 + 4 * $i);
        if ($s < CFB_DIFSECT) {
            $difat[] = $s;
        }
    }
    $next = cfb_u32($data, 508);
    $guard = 0;
    while ($next < CFB_DIFSECT && $guard++ < 65536) {
        $off = 512 + $next * $ssz;
        if ($off + $ssz > strlen($data)) {
            return null;
        }
        for ($i = 0; $i < $ssz / 4 - 1; $i++) {
            $s = cfb_u32($data, $off + 4 * $i);
            if ($s < CFB_DIFSECT) {
                $difat[] = $s;
            }
        }
        $next = cfb_u32($data, $off + $ssz - 4);
    }

    // FAT.
    $fat = [];
    foreach (array_slice($difat, 0, $nFat > 0 ? $nFat : count($difat)) as $fs) {
        $off = 512 + $fs * $ssz;
        if ($off + $ssz > strlen($data)) {
            return null;
        }
        for ($i = 0; $i < $ssz / 4; $i++) {
            $fat[] = cfb_u32($data, $off + 4 * $i);
        }
    }

    $sectorData = static function (int $s) use ($data, $ssz): ?string {
        $off = 512 + $s * $ssz;
        if ($s < 0 || $off + $ssz > strlen($data)) {
            return null;
        }
        return substr($data, $off, $ssz);
    };
    $chain = static function (int $start) use ($fat): array {
        $out = [];
        $s = $start;
        $g = 0;
        while ($s < CFB_ENDOFCHAIN && $g++ < 65536) {
            if ($s < 0 || $s >= count($fat)) {
                break;
            }
            $out[] = $s;
            $s = $fat[$s];
        }
        return $out;
    };

    // Direktori.
    $root = null;
    $target = null;
    foreach ($chain($dirStart) as $sec) {
        $blk = $sectorData($sec);
        if ($blk === null) {
            return null;
        }
        for ($o = 0; $o + 128 <= $ssz; $o += 128) {
            $nlen = cfb_u16($blk, $o + 64);
            if ($nlen < 2) {
                continue;
            }
            $nm = mb_convert_encoding(substr($blk, $o, $nlen - 2), 'UTF-8', 'UTF-16LE');
            $type = ord($blk[$o + 66]);
            if ($type === 5 && $root === null) {
                $root = ['start' => cfb_u32($blk, $o + 116), 'size' => cfb_u64($blk, $o + 120)];
            }
            if ($type === 2 && strcasecmp($nm, $name) === 0 && $target === null) {
                $target = ['start' => cfb_u32($blk, $o + 116), 'size' => cfb_u64($blk, $o + 120)];
            }
        }
    }
    if ($target === null) {
        return null;
    }

    if ($target['size'] < $miniCutoff) {
        // Mini stream: data disimpan di stream Root Entry, sektor mini 64 byte.
        if ($root === null) {
            return null;
        }
        $mini = '';
        foreach ($chain((int)$root['start']) as $sec) {
            $blk = $sectorData($sec);
            if ($blk === null) {
                return null;
            }
            $mini .= $blk;
        }
        $mini = substr($mini, 0, (int)$root['size']);

        $miniFat = [];
        foreach ($chain($miniFatStart) as $sec) {
            $blk = $sectorData($sec);
            if ($blk === null) {
                return null;
            }
            for ($o = 0; $o + 4 <= $ssz; $o += 4) {
                $miniFat[] = cfb_u32($blk, $o);
            }
        }
        $out = '';
        $s = (int)$target['start'];
        $g = 0;
        while ($s < CFB_ENDOFCHAIN && $g++ < 65536) {
            if ($s < 0 || $s >= count($miniFat)) {
                break;
            }
            $out .= substr($mini, $s * 64, 64);
            $s = $miniFat[$s];
        }
        return substr($out, 0, (int)$target['size']);
    }

    $out = '';
    foreach ($chain((int)$target['start']) as $sec) {
        $blk = $sectorData($sec);
        if ($blk === null) {
            return null;
        }
        $out .= $blk;
    }
    return substr($out, 0, (int)$target['size']);
}

/**
 * Ekstrak teks penuh dokumen Word binary dari stream WordDocument + table
 * stream lewat piece table (CLX di FIB offset 0x01A2 untuk Word 97-2003).
 */
function doc_extract_text(string $wd, string $tbl): ?string
{
    $clx = null;
    foreach ([0x01A2, 0x01A4, 0x01A6] as $off) {
        if ($off + 8 > strlen($wd)) {
            continue;
        }
        $fc = cfb_u32($wd, $off);
        $lcb = cfb_u32($wd, $off + 4);
        if ($fc > 0 && $lcb > 0 && $fc + $lcb <= strlen($tbl)) {
            $clx = substr($tbl, $fc, $lcb);
            break;
        }
    }
    if ($clx === null) {
        return null;
    }

    // CLX: rangkaian Prc (0x01) lalu Pcdt (0x02) berisi PlcPcd.
    $i = 0;
    $text = '';
    while ($i < strlen($clx)) {
        $t = ord($clx[$i]);
        if ($t === 0x01) {
            if ($i + 3 > strlen($clx)) {
                return null;
            }
            $i += 3 + cfb_u16($clx, $i + 1);
        } elseif ($t === 0x02) {
            if ($i + 5 > strlen($clx)) {
                return null;
            }
            $lcb = cfb_u32($clx, $i + 1);
            $plc = substr($clx, $i + 5, $lcb);
            $n = intdiv($lcb - 4, 12);
            if ($n < 1) {
                return null;
            }
            $cps = [];
            for ($k = 0; $k <= $n; $k++) {
                $cps[] = cfb_u32($plc, 4 * $k);
            }
            for ($k = 0; $k < $n; $k++) {
                $pcd = substr($plc, 4 * ($n + 1) + 8 * $k, 8);
                $fcRaw = cfb_u32($pcd, 2);
                $compressed = ($fcRaw & 0x40000000) !== 0;
                $fc = $fcRaw & 0x3FFFFFFF;
                $cch = $cps[$k + 1] - $cps[$k];
                if ($cch <= 0) {
                    continue;
                }
                if ($compressed) {
                    $raw = substr($wd, intdiv($fc, 2), $cch);
                    $text .= $raw === false ? '' : mb_convert_encoding($raw, 'UTF-8', 'CP1252');
                } else {
                    $raw = substr($wd, $fc, $cch * 2);
                    $text .= $raw === false ? '' : mb_convert_encoding($raw, 'UTF-8', 'UTF-16LE');
                }
            }
            break;
        } else {
            return null;
        }
    }
    return $text;
}

/**
 * Pecah teks dokumen Word menjadi baris-baris tabel utama.
 * Struktur stream: tiap sel diakhiri \x07, tiap baris ditutup satu tanda
 * akhir-baris tambahan (segmen kosong). Return ['headers' => [...], 'rows' => [[...], ...]].
 */
function doc_extract_table(string $full): array
{
    $clean = static function (string $s): string {
        $s = str_replace(["\r\n", "\r", "\x0b", "\x0c"], ' ', $s);
        $s = preg_replace('/[\x00-\x08\x0b-\x1f]/u', '', $s) ?? '';
        return trim(preg_replace('/\s+/u', ' ', $s) ?? '');
    };

    $mark = strpos($full, "\x07");
    if ($mark === false) {
        return [[], []];
    }
    $head = substr($full, 0, $mark);
    // Segmen sebelum tanda \x07 pertama = teks pembuka + isi sel pertama.
    $p = strrpos($head, "\r");
    $firstCell = $p === false ? $head : substr($head, $p + 1);

    $segs = explode("\x07", substr($full, $mark + 1));
    array_unshift($segs, $firstCell);
    $total = count($segs);

    // Baris header: segmen non-kosong berurutan sebelum tanda baris pertama.
    $i = 0;
    $header = [];
    while ($i < $total && $clean($segs[$i]) !== '') {
        $header[] = $clean($segs[$i]);
        $i++;
    }
    $n = count($header);
    $rows = [];
    if ($n >= 2) {
        // Tiap baris = N sel + 1 tanda akhir-baris (segmen kosong).
        while ($i + $n < $total) {
            $chunk = array_slice($segs, $i, $n + 1);
            if ($clean($chunk[$n]) !== '') {
                break; // bukan tanda akhir baris → tabel berakhir
            }
            $rows[] = array_map($clean, array_slice($chunk, 0, $n));
            $i += $n + 1;
        }
    }

    if ($rows === []) {
        // Fallback: tebak lebar kolom dari konsistensi tanda akhir-baris,
        // mulai dari segmen pertama (header = chunk pertama).
        $total2 = $total;
        for ($k = 2; $k <= 15 && $k * 3 <= $total2; $k++) {
            $tot = 0;
            $ok = 0;
            for ($j = 0; $j + $k <= $total2; $j += $k) {
                $tot++;
                if ($clean($segs[$j + $k - 1]) === '') {
                    $ok++;
                }
            }
            if ($tot >= 2 && $ok === $tot) {
                $rows = [];
                $header = [];
                for ($j = 0; $j + $k <= $total2; $j += $k) {
                    $cells = array_map($clean, array_slice($segs, $j, $k - 1));
                    if ($header === []) {
                        $header = $cells;
                    } else {
                        $rows[] = $cells;
                    }
                }
                break;
            }
        }
    }

    return [$header, $rows];
}

/**
 * Entry point: isi file .doc → ['headers' => [...], 'rows' => [[...], ...]].
 * Keluar dengan json_error bila file tidak dapat diparse.
 */
function doc_extract_rows(string $binary): array
{
    $wd = cfb_read_stream($binary, 'WordDocument');
    if ($wd === null || $wd === '') {
        json_error('File .doc tidak dapat dibaca (bukan dokumen Word yang valid). Coba simpan ulang sebagai .xlsx atau .docx.', 422);
    }
    $tbl = cfb_read_stream($binary, '1Table');
    if ($tbl === null || $tbl === '') {
        $tbl = cfb_read_stream($binary, '0Table');
    }
    if ($tbl === null || $tbl === '') {
        json_error('File .doc tidak dapat dibaca (table stream hilang). Coba simpan ulang sebagai .xlsx atau .docx.', 422);
    }
    $text = doc_extract_text($wd, $tbl);
    if ($text === null || strpos($text, "\x07") === false) {
        json_error('Tidak menemukan tabel di dalam dokumen Word. Pastikan data personel berbentuk tabel, atau simpan ulang sebagai .xlsx.', 422);
    }
    [$headers, $rows] = doc_extract_table($text);
    if ($rows === []) {
        json_error('Tabel di dokumen Word kosong atau tidak dapat dibaca. Coba simpan ulang sebagai .xlsx.', 422);
    }
    return ['headers' => $headers, 'rows' => $rows];
}
