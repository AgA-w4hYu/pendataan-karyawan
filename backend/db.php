<?php
declare(strict_types=1);

function db_config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $cfg = require __DIR__ . '/config.php';
    }
    return $cfg['db'];
}

/**
 * Deteksi otomatis lokasi socket MySQL/MariaDB di berbagai instalasi XAMPP.
 * Kalau tidak ditemukan, koneksi otomatis fallback ke TCP host:port.
 */
function detect_mysql_socket(): string
{
    $candidates = [
        // XAMPP Linux
        '/opt/lampp/var/mysql/mysql.sock',
        // XAMPP macOS
        '/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock',
        // XAMPP Windows
        'C:/xampp/mysql/mysql.sock',
        'C:\\xampp\\mysql\\mysql.sock',
        // MySQL/MariaDB bawaan Linux (bukan XAMPP)
        '/var/run/mysqld/mysqld.sock',
        '/var/lib/mysql/mysql.sock',
        // macOS Homebrew / lainnya
        '/tmp/mysql.sock',
    ];
    foreach ($candidates as $path) {
        if ($path && @file_exists($path)) {
            return $path;
        }
    }
    return '';
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $cfg = db_config();
    $dsn = 'mysql:charset=utf8mb4';
    $socket = $cfg['socket'] ?: detect_mysql_socket();
    if ($socket !== '' && file_exists($socket)) {
        $dsn .= ';unix_socket=' . $socket;
    } else {
        $dsn .= ';host=' . $cfg['host'] . ';port=' . (int)$cfg['port'];
    }

    $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$cfg['name']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `{$cfg['name']}`");
    $pdo->exec('SET NAMES utf8mb4');

    ensure_schema($pdo);
    return $pdo;
}

function ensure_schema(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS employees (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        nama_lengkap  VARCHAR(255) NOT NULL,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB');

    $pdo->exec('CREATE TABLE IF NOT EXISTS biodata_fields (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        label       VARCHAR(255) NOT NULL,
        field_type  ENUM(\'text\',\'date\',\'number\',\'dropdown\') NOT NULL DEFAULT \'text\',
        options     TEXT NULL,
        urutan      INT NOT NULL DEFAULT 0,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB');

    $pdo->exec('CREATE TABLE IF NOT EXISTS employee_biodata (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        employee_id INT UNSIGNED NOT NULL,
        field_id    INT UNSIGNED NOT NULL,
        value       TEXT NULL,
        UNIQUE KEY uq_employee_field (employee_id, field_id),
        CONSTRAINT fk_eb_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
        CONSTRAINT fk_eb_field    FOREIGN KEY (field_id)    REFERENCES biodata_fields (id) ON DELETE CASCADE
    ) ENGINE=InnoDB');
}