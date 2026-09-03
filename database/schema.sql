-- ============================================================
-- Skema Database: Sistem Pendataan Karyawan Internal
-- Pattern EAV (Entity-Attribute-Value) untuk biodata dinamis.
-- Database dibuat otomatis oleh aplikasi saat pertama kali jalan;
-- file ini untuk referensi / import manual via phpMyAdmin.
-- ============================================================

CREATE DATABASE IF NOT EXISTS pendataan_karyawan
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pendataan_karyawan;

-- Data inti karyawan
CREATE TABLE IF NOT EXISTS employees (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama_lengkap  VARCHAR(255) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Definisi field biodata (dinamis, dikelola admin dari UI)
CREATE TABLE IF NOT EXISTS biodata_fields (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  label       VARCHAR(255) NOT NULL,
  field_type  ENUM('text','date','number','dropdown') NOT NULL DEFAULT 'text',
  options     TEXT NULL COMMENT 'JSON array, hanya untuk tipe dropdown',
  urutan      INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Nilai biodata per karyawan per field
CREATE TABLE IF NOT EXISTS employee_biodata (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id INT UNSIGNED NOT NULL,
  field_id    INT UNSIGNED NOT NULL,
  value       TEXT NULL,
  UNIQUE KEY uq_employee_field (employee_id, field_id),
  CONSTRAINT fk_eb_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_eb_field    FOREIGN KEY (field_id)    REFERENCES biodata_fields (id) ON DELETE CASCADE
) ENGINE=InnoDB;