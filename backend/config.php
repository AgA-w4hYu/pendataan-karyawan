<?php
declare(strict_types=1);

date_default_timezone_set('Asia/Jakarta');

// ============================================================
//  KONFIGURASI DATABASE
//
//  Biasanya TIDAK perlu diubah sama sekali — aplikasi otomatis
//  mendeteksi lokasi MySQL di XAMPP (Linux/macOS/Windows) dan
//  otomatis membuat database + tabel saat pertama kali diakses.
//
//  Ubah bagian ini HANYA jika:
//    - MySQL Anda bukan XAMPP (misal MySQL terpisah / MariaDB sistem),
//    - user/password MySQL Anda berbeda.
//
//  Semua nilai juga bisa di-override lewat variabel lingkungan
//  (DB_SOCKET, DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME).
// ============================================================

return [
    'db' => [
        // Socket MySQL — biarkan '' agar dideteksi otomatis.
        // Isi manual contoh: '/var/run/mysqld/mysqld.sock'
        'socket' => getenv('DB_SOCKET') ?: '',
        'host'   => getenv('DB_HOST') ?: '127.0.0.1',
        'port'   => (int)(getenv('DB_PORT') ?: 3306),
        'user'   => getenv('DB_USER') ?: 'root',
        'pass'   => getenv('DB_PASS') ?: '',
        'name'   => getenv('DB_NAME') ?: 'pendataan_karyawan',
    ],
];