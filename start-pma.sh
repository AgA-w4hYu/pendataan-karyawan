#!/usr/bin/env bash
# Helper phpMyAdmin — menjalankan phpMyAdmin (bawaan XAMPP) via PHP built-in server.
# Syarat: MySQL/MariaDB (XAMPP) sudah berjalan — lihat README.md.
#
# Catatan: di Windows, phpMyAdmin biasanya sudah dilayani Apache XAMPP
# (http://localhost/phpmyadmin) — pakai start-pma.bat saja.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${PMA_HOST:-127.0.0.1}"
PORT="${PMA_PORT:-8080}"
LOG_DIR="${HOME}/logs"
LOG="${LOG_DIR}/pma-server.log"
PID_FILE="${ROOT}/.pma.pid"

# --- Deteksi folder phpMyAdmin di berbagai instalasi XAMPP ---
detect_pma() {
  for c in \
    "/opt/lampp/phpmyadmin" \
    "/Applications/XAMPP/xamppfiles/phpmyadmin" \
    "/c/xampp/phpmyadmin" \
    "C:/xampp/phpmyadmin"; do
    [ -d "$c" ] && { echo "$c"; return; }
  done
  echo ""
}

# --- Deteksi PHP: XAMPP per-OS dulu, lalu `php` di PATH ---
detect_php() {
  if [ -n "${PHP_BIN:-}" ]; then
    command -v "${PHP_BIN}" >/dev/null 2>&1 && echo "${PHP_BIN}" || echo "${PHP_BIN}"
    return
  fi
  for c in \
    "/opt/lampp/bin/php" \
    "/Applications/XAMPP/xamppfiles/bin/php" \
    "/c/xampp/php/php.exe" \
    "C:/xampp/php/php.exe"; do
    [ -x "$c" ] && { echo "$c"; return; }
  done
  command -v php 2>/dev/null || true
}

PMA_SRC="$(detect_pma)"
PHP_BIN="$(detect_php)"

port_open() {
  (exec 3<>"/dev/tcp/${HOST}/${PORT}") 2>/dev/null && { exec 3>&-; exec 3<&-; return 0; } || return 1
}

case "${1:-status}" in
  start)
    if port_open; then
      echo "phpMyAdmin sudah berjalan di http://${HOST}:${PORT}"
      exit 0
    fi
    if [ -z "$PMA_SRC" ]; then
      echo "[ERROR] Folder phpMyAdmin tidak ditemukan di instalasi XAMPP." >&2
      echo "  Pastikan XAMPP terpasang di lokasi standar, atau gunakan:" >&2
      echo "  PMA_SRC=/path/ke/phpmyadmin $0 start" >&2
      exit 1
    fi
    if [ -z "$PHP_BIN" ]; then
      echo "[ERROR] PHP tidak ditemukan." >&2
      echo "  Pasang XAMPP dari https://www.apachefriends.org lalu jalankan ulang." >&2
      exit 1
    fi
    mkdir -p "$LOG_DIR"
    # Lepaskan proses dari sesi shell agar server tetap hidup setelah skrip selesai
    # (setsid untuk Linux/Git-Bash; fallback nohup+disown untuk macOS).
    if command -v setsid >/dev/null 2>&1; then
      setsid nohup "$PHP_BIN" -d session.save_path="$LOG_DIR" -d upload_tmp_dir="$LOG_DIR" \
        -S "${HOST}:${PORT}" -t "$PMA_SRC" >> "$LOG" 2>&1 &
    else
      nohup "$PHP_BIN" -d session.save_path="$LOG_DIR" -d upload_tmp_dir="$LOG_DIR" \
        -S "${HOST}:${PORT}" -t "$PMA_SRC" >> "$LOG" 2>&1 &
      disown 2>/dev/null || true
    fi
    echo $! > "$PID_FILE"
    sleep 2
    if port_open; then
      echo "phpMyAdmin berjalan: http://${HOST}:${PORT}  (log: ${LOG})"
    else
      echo "[ERROR] Gagal menjalankan phpMyAdmin. Cek log: ${LOG}" >&2
      exit 1
    fi
    ;;
  stop)
    if [ -f "$PID_FILE" ] && kill "$(cat "$PID_FILE")" 2>/dev/null; then
      rm -f "$PID_FILE"
      echo "phpMyAdmin dihentikan."
    else
      rm -f "$PID_FILE"
      echo "Tidak ada proses phpMyAdmin yang berjalan."
    fi
    ;;
  status)
    if port_open; then
      echo "phpMyAdmin AKTIF di http://${HOST}:${PORT}"
    else
      echo "phpMyAdmin TIDAK berjalan. Jalankan: $0 start"
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|status}"
    exit 1
    ;;
esac