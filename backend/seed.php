<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

$clear = in_array('--clear', $argv, true);

if ($clear) {
    db()->exec('DELETE FROM employee_biodata');
    db()->exec('DELETE FROM employees');
    db()->exec('DELETE FROM biodata_fields');
    echo "Database dibersihkan.\n";
    exit(0);
}

$pdo = db();
$fieldCount = (int)$pdo->query('SELECT COUNT(*) FROM biodata_fields')->fetchColumn();
$employeeCount = (int)$pdo->query('SELECT COUNT(*) FROM employees')->fetchColumn();

if ($fieldCount > 0 || $employeeCount > 0) {
    echo "Database sudah berisi data — tidak ada yang di-seed.\n";
    echo "Gunakan `php seed.php --clear` untuk mengosongkan.\n";
    exit(0);
}

// Contoh field biodata
$fields = [
    ['Nomor Telepon', 'text', null],
    ['Alamat', 'text', null],
    ['Tanggal Lahir', 'date', null],
    ['Divisi', 'dropdown', json_encode(['IT', 'HRD', 'Finance', 'Marketing'], JSON_UNESCAPED_UNICODE)],
    ['Gaji Pokok', 'number', null],
    ['Status', 'dropdown', json_encode(['Aktif', 'Resign', 'Cuti'], JSON_UNESCAPED_UNICODE)],
];

$insertField = $pdo->prepare('INSERT INTO biodata_fields (label, field_type, options, urutan) VALUES (?, ?, ?, ?)');
$fieldIds = [];
foreach ($fields as $i => [$label, $type, $options]) {
    $insertField->execute([$label, $type, $options, $i + 1]);
    $fieldIds[] = (int)$pdo->lastInsertId();
}

// Contoh personel
$samples = [
    ['Budi Santoso', ['081234567890', 'Jl. Merdeka No. 1', '1990-05-12', 'IT', '8500000', 'Aktif']],
    ['Siti Rahayu', ['081298765432', 'Jl. Sudirman No. 45', '1992-11-03', 'HRD', '7000000', 'Aktif']],
    ['Agus Wijaya', ['082112345678', 'Jl. Gatot Subroto No. 8', '1988-02-25', 'Finance', '9000000', 'Cuti']],
];

$insertEmployee = $pdo->prepare('INSERT INTO employees (nama_lengkap) VALUES (?)');
$insertBiodata = $pdo->prepare('INSERT INTO employee_biodata (employee_id, field_id, value) VALUES (?, ?, ?)');

foreach ($samples as [$nama, $values]) {
    $insertEmployee->execute([$nama]);
    $employeeId = (int)$pdo->lastInsertId();
    foreach ($fieldIds as $i => $fieldId) {
        $insertBiodata->execute([$employeeId, $fieldId, $values[$i] ?? null]);
    }
}

echo "Seed selesai: " . count($fields) . " field, " . count($samples) . " personel contoh.\n";
echo "Gunakan `php seed.php --clear` untuk mengosongkan database.\n";