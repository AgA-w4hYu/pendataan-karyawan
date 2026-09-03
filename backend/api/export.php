<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/../vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

function export_xlsx(): void
{
    $pdo = db();

    $fields = [];
    foreach ($pdo->query('SELECT id, label, field_type, options, urutan
                          FROM biodata_fields ORDER BY urutan ASC, id ASC')->fetchAll() as $f) {
        $fields[(int)$f['id']] = $f;
    }

    // Kolom yang dipilih: parameter `fields` = daftar id dipisah koma,
    // plus token "nama" untuk kolom Nama Lengkap. Kosong = semua kolom.
    $requested = trim((string)($_GET['fields'] ?? ''));
    $includeNama = true;
    $selected = [];
    if ($requested !== '') {
        $parts = array_filter(array_map('trim', explode(',', $requested)), fn($p) => $p !== '');
        $includeNama = in_array('nama', $parts, true);
        foreach ($parts as $part) {
            if ($part === 'nama') {
                continue;
            }
            $fid = (int)$part;
            if (isset($fields[$fid])) {
                $selected[$fid] = $fields[$fid];
            }
        }
    } else {
        $selected = $fields;
    }
    uasort($selected, fn($a, $b) => $a['urutan'] <=> $b['urutan']);

    // Data — bisa disaring dengan filter kolom dropdown (`filters`)
    [$filterChunks, $filterParams] = dropdown_filter_sql();
    $where = $filterChunks ? 'WHERE ' . implode(' AND ', $filterChunks) : '';
    $stmt = $pdo->prepare("SELECT id, nama_lengkap FROM employees e $where
                            ORDER BY e.nama_lengkap ASC, e.id ASC");
    $stmt->execute($filterParams);
    $employees = $stmt->fetchAll();
    $biodata = [];
    if (count($employees) > 0 && count($selected) > 0) {
        $ids = array_column($employees, 'id');
        $fieldIds = array_keys($selected);
        $idPh = implode(',', array_fill(0, count($ids), '?'));
        $fieldPh = implode(',', array_fill(0, count($fieldIds), '?'));
        $stmt = $pdo->prepare("SELECT employee_id, field_id, value FROM employee_biodata
                               WHERE employee_id IN ($idPh) AND field_id IN ($fieldPh)");
        $stmt->execute([...$ids, ...$fieldIds]);
        foreach ($stmt->fetchAll() as $row) {
            $biodata[$row['employee_id']][(string)$row['field_id']] = $row['value'];
        }
    }

    // Bangun spreadsheet
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Data Personel');

    $header = [];
    if ($includeNama) {
        $header[] = 'Nama Lengkap';
    }
    foreach ($selected as $field) {
        $header[] = $field['label'];
    }
    $sheet->fromArray($header, null, 'A1');

    $rowIndex = 2;
    foreach ($employees as $employee) {
        $colIndex = 1;
        if ($includeNama) {
            $coord = Coordinate::stringFromColumnIndex($colIndex) . $rowIndex;
            $sheet->setCellValueExplicit($coord, $employee['nama_lengkap'], DataType::TYPE_STRING);
            $colIndex++;
        }
        foreach ($selected as $fieldId => $field) {
            $value = $biodata[$employee['id']][(string)$fieldId] ?? '';
            $coord = Coordinate::stringFromColumnIndex($colIndex) . $rowIndex;
            $cell = $sheet->getCell($coord);
            if ($field['field_type'] === 'number' && $value !== '') {
                $cell->setValueExplicit((float)$value, DataType::TYPE_NUMERIC);
            } else {
                $cell->setValueExplicit((string)$value, DataType::TYPE_STRING);
            }
            $colIndex++;
        }
        $rowIndex++;
    }

    // Styling: header gelap tebal, border tipis, lebar kolom auto-fit
    $lastCol = $sheet->getHighestColumn();
    $lastRow = $sheet->getHighestRow();
    $sheet->getStyle("A1:{$lastCol}1")->applyFromArray([
        'font'      => ['bold' => true, 'color' => ['rgb' => 'F5F1E8'], 'size' => 11],
        'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1A1815']],
        'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
    ]);
    $sheet->getStyle("A1:{$lastCol}{$lastRow}")->applyFromArray([
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_THIN,
                'color'       => ['rgb' => 'DAD5C8'],
            ],
        ],
    ]);
    $sheet->getStyle("A2:{$lastCol}{$lastRow}")->getAlignment()
        ->setVertical(Alignment::VERTICAL_TOP);
    foreach (range('A', $lastCol) as $column) {
        $sheet->getColumnDimension($column)->setAutoSize(true);
    }
    $sheet->freezePane('A2');

    $filename = 'data-personel-' . date('Ymd-His') . '.xlsx';
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: max-age=0');

    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');
    exit;
}