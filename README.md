# 📋 Sistem Pendataan Karyawan Internal

Aplikasi web untuk **mencatat data karyawan** menggantikan file Excel manual.
Cocok dipakai di jaringan internal kantor — **satu admin, tanpa login**.

- ➕ Tambah / edit / hapus karyawan (dengan konfirmasi sebelum hapus)
- 🧩 **Kolom biodata dinamis** — buat kolom sendiri kapan saja (teks, tanggal, angka, dropdown) tanpa ubah kode
- 🔍 Pencarian nama secara real-time + pagination (ramah untuk 1000-an karyawan)
- 📊 **Export ke Excel (.xlsx)** — pilih kolom yang mau diexport, hasilnya tabel rapi (header tebal, border, lebar kolom otomatis)
- 🗄️ Semua data tersimpan terpusat di **MySQL** (bukan banyak file Excel)
- 🖥️ Monitor database lewat **phpMyAdmin**

---

## 📌 Ringkasan Cara Pasang (2 langkah inti)

> **Hanya butuh 2 hal:** (1) XAMPP, (2) folder proyek ini.
> Tidak perlu install Node.js, Composer, atau apa pun — frontend sudah di-build dan
> library PHP sudah disertakan dalam folder proyek.

| OS | Langkah 1 | Langkah 2 | Langkah 3 |
|---|---|---|---|
| **Windows** | Install XAMPP → Start MySQL & Apache | Ambil folder proyek | Klik ganda `start-app.bat` |
| **macOS** | Install XAMPP → Start MySQL | Ambil folder proyek | `./start-app.sh start` |
| **Linux** | Install XAMPP → Start MySQL | Ambil folder proyek | `./start-app.sh start` |

Detail lengkapnya ada di bawah — ikuti saja urutannya, tiap langkah dijelaskan.

---

## ✅ 0. Yang Perlu Anda Siapkan

1. **XAMPP** — paket lengkap berisi Apache, MySQL/MariaDB, PHP, dan phpMyAdmin.
   Unduh dari **https://www.apachefriends.org/download.html** (pilih versi terbaru, minimal PHP 8.2).
2. **Folder proyek ini** — cara mendapatkannya ada di Langkah 3.
3. **Koneksi internet** — hanya saat mengunduh XAMPP dan proyek. Setelah itu aplikasi jalan **offline** (tidak butuh internet).

---

## 🪟 LANGKAH 1 — Instal XAMPP (pilih sesuai OS Anda)

### Windows
1. Buka **https://www.apachefriends.org/download.html**, unduh file **`xampp-windows-x64-...-installer.exe`**.
2. Klik ganda file installer → klik **Next** terus sampai selesai (biarkan folder default **`C:\xampp`**).
3. Centang **"Do you want to start the Control Panel now?"** → **Finish**.
4. Jendela **XAMPP Control Panel** terbuka. Klik tombol **Start** pada baris **MySQL** dan **Apache** (tulisan berubah jadi hijau jika berhasil).
5. Tes: buka browser ke **http://localhost/phpmyadmin** — halaman phpMyAdmin muncul = sukses.

### macOS
1. Buka **https://www.apachefriends.org/download.html**, unduh file **`xampp-osx-...-installer.dmg`**.
2. Klik ganda file `.dmg`, lalu **seret folder XAMPP ke folder Applications** (terpasang di **`/Applications/XAMPP`**).
3. Buka aplikasi **XAMPP Control** (dari Launchpad) → klik **Start** pada baris **MySQL**.
   - macOS bisa meminta konfirmasi izin — klik **Open** / masukkan password.
4. (Opsional, untuk phpMyAdmin lewat Apache) klik juga **Start** pada baris **Apache**, lalu buka **http://localhost/phpmyadmin**.

### Linux (Ubuntu/Debian & turunannya)
1. Buka **https://www.apachefriends.org/download.html**, unduh file **`xampp-linux-x64-...-installer.run`**.
2. Buka terminal di folder tempat file terunduh (biasanya `~/Downloads`), lalu jalankan:
   ```bash
   chmod +x xampp-linux-*-installer.run
   sudo ./xampp-linux-*-installer.run
   ```
   (Ikuti panduan instalasi di layar — folder hasilnya **`/opt/lampp`**.)
3. Nyalakan MySQL:
   ```bash
   sudo /opt/lampp/lampp startmysql
   ```
   > **Catatan:** `sudo` akan menanyakan password user Anda. Di Linux, MySQL
   > memerlukan `sudo` setiap kali device dinyalakan ulang — cukup jalankan
   > perintah di atas lagi setelah restart.

---

## 📥 LANGKAH 2 — Ambil Kode Proyek

Pilih salah satu cara:

### Cara A — Git Clone (disarankan, mudah update)
Buka terminal (Windows: bisa pakai Git Bash yang sudah ada di XAMPP installer; macOS/Linux: Terminal), lalu:

```bash
git clone https://github.com/AgA-w4hYu/pendataan-karyawan.git
cd pendataan-karyawan
```

### Cara B — Download ZIP (tanpa git)
1. Buka **https://github.com/AgA-w4hYu/pendataan-karyawan**.
2. Klik tombol hijau **Code ▾** → **Download ZIP**.
3. Ekstrak file ZIP → Anda mendapat folder **`pendataan-karyawan`**.

---

## ▶️ LANGKAH 3 — Jalankan Aplikasi

> Pastikan MySQL (dan untuk Windows: Apache) sudah **Start** seperti di Langkah 1.

### Windows
1. Buka folder proyek, **klik ganda `start-app.bat`**.
2. Browser otomatis terbuka ke **http://127.0.0.1:8081** — aplikasi siap dipakai!
3. Jendela hitam (CMD) yang muncul adalah servernya — **jangan ditutup** selama aplikasi dipakai. Tutup jendela itu = aplikasi berhenti.

### macOS / Linux
1. Buka terminal **di dalam folder proyek**:
   ```bash
   cd pendataan-karyawan
   ```
2. Jalankan:
   ```bash
   ./start-app.sh start
   ```
   - Jika muncul error "Permission denied", jalankan sekali: `chmod +x start-app.sh start-pma.sh`
3. Buka browser ke **http://127.0.0.1:8081**.
4. Perintah lain yang tersedia:
   ```bash
   ./start-app.sh stop      # hentikan aplikasi
   ./start-app.sh status    # cek apakah aplikasi berjalan
   ```

> 💡 **Mengubah port?** Port default 8081. Kalau sibuk, jalankan:
> `APP_PORT=8082 ./start-app.sh start` (Windows: ubah angka 8081 di `start-app.bat` jadi 8082).

---

## 🎉 Aplikasi Berhasil Jalan — Sekarang Apa?

Saat pertama kali dibuka, aplikasi **otomatis membuat database `pendataan_karyawan`
beserta tabel-tabelnya di MySQL** — Anda tidak perlu import SQL apa pun.

1. **Tambahkan karyawan** → klik tombol **+ Tambah Karyawan** di pojok kanan atas, isi Nama Lengkap (wajib) dan biodata lain, klik **Simpan**.
2. **Buat kolom biodata baru** → klik **Kelola Kolom** → **+ Tambah Kolom** → isi judul kolom (misal "Nomor BPJS"), pilih tipe (Teks / Tanggal / Angka / Dropdown — untuk dropdown isi pilihan dipisah koma, misal: `IT,HRD,Finance`), klik **Simpan**. Kolom baru **langsung muncul (kosong) di semua karyawan**.
3. **Edit / hapus karyawan** → tombol **Edit** / **Hapus** di baris karyawan. Hapus selalu menampilkan dialog konfirmasi (data dihapus **permanen**).
4. **Cari** → ketik nama di kotak pencarian, tabel langsung terfilter.
5. **Export ke Excel** → klik **Export ke Excel** → centang kolom yang diinginkan → **Export**. File `.xlsx` terunduh dalam bentuk tabel rapi, siap dikirim.

### (Opsional) Isi data contoh
Kalau ingin mencoba dengan data contoh dulu:
```bash
# Windows (di CMD dalam folder proyek):
C:\xampp\php\php.exe backend\seed.php

# macOS / Linux:
/Applications/XAMPP/xamppfiles/bin/php backend/seed.php   # macOS
/opt/lampp/bin/php backend/seed.php                       # Linux
```
> Untuk mengosongkan semua data: jalankan perintah yang sama dengan tambahan `--clear`.

---

## 🖥️ Memantau Database dengan phpMyAdmin

phpMyAdmin sudah termasuk dalam XAMPP. Cara membukanya:

| OS | Cara |
|---|---|
| **Windows** | Apache sudah Start → buka **http://localhost/phpmyadmin** |
| **macOS / Linux** | Jalankan `./start-pma.sh start` lalu buka **http://127.0.0.1:8080** |

- **Login:** user `root`, **password dikosongkan** (kosongkan saja kolom password, langsung klik Go).
- Pilih database **`pendataan_karyawan`** di panel kiri untuk melihat 3 tabel:
  - `employees` — data inti karyawan (nama, tanggal dibuat/diubah)
  - `biodata_fields` — daftar kolom biodata yang Anda buat
  - `employee_biodata` — nilai biodata per karyawan per kolom

> Hati-hati saat menghapus/mengubah data langsung di phpMyAdmin — aplikasi dan
> phpMyAdmin membaca database yang sama, jadi perubahan langsung terlihat di aplikasi.

---

## 📁 Struktur Folder Proyek

```
pendataan-karyawan/
├── backend/              # Kode PHP (backend & API)
│   ├── api/              #   Endpoint REST API
│   ├── config.php        #   Konfigurasi database (jarang perlu diubah)
│   ├── db.php            #   Koneksi MySQL + buat tabel otomatis
│   ├── seed.php          #   Isi data contoh (opsional)
│   └── vendor/           #   Library PHP (sudah disertakan, jangan dihapus)
├── frontend/             # Kode React + Tailwind (hanya perlu jika ingin rebuild)
├── public/               # Hasil build frontend + font (disajikan ke browser)
├── database/schema.sql   # Struktur database (referensi — otomatis dibuat juga)
├── router.php            # Router: API → backend, lainnya → frontend
├── start-app.sh          # Jalankan aplikasi (macOS/Linux)
├── start-app.bat         # Jalankan aplikasi (Windows)
├── start-pma.sh          # Jalankan phpMyAdmin (macOS/Linux)
└── start-pma.bat         # Buka phpMyAdmin (Windows)
```

---

## 🔧 Troubleshooting (Masalah Umum & Solusinya)

| Gejala | Kemungkinan Penyebab | Solusi |
|---|---|---|
| **Browser tidak bisa membuka** `http://127.0.0.1:8081` | Aplikasi belum dijalankan | Jalankan lagi Langkah 3 (klik ganda `start-app.bat` / `./start-app.sh start`) |
| **Aplikasi terbuka tapi data kosong / muncul error "database"** | MySQL belum berjalan | Windows: Start MySQL di XAMPP Control Panel. macOS/Linux: `sudo /opt/lampp/lampp startmysql` |
| **Halaman phpMyAdmin tidak terbuka** | Apache belum start (Windows) / skrip belum dijalankan (macOS/Linux) | Windows: Start Apache di Control Panel. macOS/Linux: `./start-pma.sh start` |
| **Login phpMyAdmin ditolak** | Password diisi | Kosongkan kolom password, user `root`, klik Go |
| **"Address already in use" / port 8081 sibuk** | Ada program lain di port 8081 | Ganti port: `APP_PORT=8082 ./start-app.sh start` (Windows: ubah di `start-app.bat`) |
| **macOS/Linux: "Permission denied" saat `./start-app.sh`** | File belum executable | `chmod +x start-app.sh start-pma.sh` |
| **Windows: jendela hitam langsung menutup** | PHP tidak ditemukan di `C:\xampp` | Install XAMPP di folder default `C:\xampp`, atau ubah baris `set "PHP=..."` di `start-app.bat` sesuai lokasi PHP Anda |
| **MySQL Anda bukan XAMPP (misal MariaDB terpisah / pakai password)** | Lokasi/kredensial berbeda | Edit `backend/config.php` (isikan `pass` bila ada password), atau jalankan dengan variabel: `DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=root DB_PASS=rahasia ./start-app.sh start` |
| **Angka tidak muncul / format tanggal aneh di Excel** | — | Export memakai nilai apa adanya. Untuk laporan, isi data dengan format konsisten (tanggal `YYYY-MM-DD`, angka tanpa titik ribuan) |

> Belum ketemu solusinya? Periksa isi file log:
> - Linux/macOS: `cat ~/logs/app-server.log`
> - Windows: lihat pesan error di jendela CMD yang terbuka

---

## 🔒 Keamanan (Penting!)

Karena aplikasi ini **tanpa login**, jaga agar hanya bisa diakses dari jaringan internal kantor:

1. **Default aman:** aplikasi hanya bisa diakses dari PC tempat aplikasi dijalankan (`127.0.0.1`).
2. **Akses dari PC lain di kantor (opsional):** jalankan dengan
   `APP_HOST=0.0.0.0 ./start-app.sh start`, lalu PC lain membuka `http://IP-PC-INI:8081`
   (contoh: `http://192.168.1.10:8081`). Pastikan firewall mengizinkan dan **jangan**
   memforward port ini ke internet.
3. **Jangan pernah** men-deploy aplikasi ini ke hosting publik / cloud tanpa
   menambahkan sistem login terlebih dahulu.

---

## 🧑‍💻 Untuk Pengembang (Opsional — Tidak Wajib untuk Pemakai)

Semua langkah di bawah **tidak diperlukan** untuk menjalankan aplikasi (sudah siap pakai).
Hanya dibutuhkan jika ingin mengubah tampilan/logo atau memperbarui library.

### Rebuild frontend (setelah mengubah kode React)
```bash
cd frontend
npm install        # sekali saja
npm run build      # hasilnya masuk ke folder public/
```

### Update library PHP (jarang perlu)
```bash
cd backend
php composer.phar install     # atau: composer install
```

---

## ❓ FAQ

**Q: Data saya tersimpan di mana?**
A: Di database MySQL bernama `pendataan_karyawan` — bukan di file Excel. Bisa dilihat lewat phpMyAdmin.

**Q: Kalau aplikasi ditutup, data hilang?**
A: Tidak. Data tetap aman di MySQL. Tutup/buka lagi aplikasi kapan pun, data tetap ada.

**Q: Bisa dipakai di beberapa komputer sekaligus?**
A: Bisa, lewat jaringan kantor — lihat bagian **Keamanan** poin 2 (jalankan dengan `APP_HOST=0.0.0.0`).

**Q: Perlu internet untuk menjalankan aplikasi?**
A: Tidak. Setelah XAMPP & proyek terpasang, aplikasi jalan sepenuhnya offline (font & library sudah lokal).

**Q: Bagaimana kalau MySQL perlu password?**
A: Edit `backend/config.php` (isi `'pass' => 'password-anda'`), atau pakai variabel `DB_PASS` saat menjalankan.

---

## 🛠️ Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | React + Tailwind CSS (hasil build disertakan di `public/`) |
| Backend | PHP 8.2+ (REST API) |
| Database | MySQL / MariaDB (via XAMPP) |
| Export Excel | PhpSpreadsheet |
| Server | PHP built-in web server (port 8081) + phpMyAdmin (port 8080) |

Dibuat untuk pemakaian internal kantor — satu admin, tanpa sistem login.