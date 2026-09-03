#!/usr/bin/env bash
# Helper aplikasi Pendataan Karyawan — menjalankan frontend (sudah di-build
# di public/) + API PHP via PHP built-in server.
# Syarat: MySQL/MariaDB (XAMPP) sudah berjalan — lihat README.md.
#
# Bisa di-override lewat env:
#   APP_PORT=8082 APP_HOST=0.0.0.0 ./start-app.sh start   (akses dari PC lain di kantor)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${APP_HOST:-127.0.0.1}"
PORT="${APP_PORT:-8081}"
LOG_DIR="${HOME}/logs"
LOG="${LOG_DIR}/app-server.log"
PID_FILE="${ROOT}/.app.pid"

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

PHP_BIN="$(detect_php)"

port_open() {
  (exec 3<>"/dev/tcp/${HOST}/${PORT}") 2>/dev/null && { exec 3>&-; exec 3<&-; return 0; } || return 1
}

case "${1:-status}" in
  start)
    if port_open; then
      echo "Aplikasi sudah berjalan di http://${HOST}:${PORT}"
      exit 0
    fi
    if [ -z "$PHP_BIN" ]; then
      echo "[ERROR] PHP tidak ditemukan." >&2
      echo "  Pasang XAMPP dari https://www.apachefriends.org lalu jalankan ulang," >&2
      echo "  atau install PHP dan pastikan perintah \`php\` tersedia di PATH." >&2
      exit 1
    fi
    if [ ! -f "${ROOT}/public/index.html" ]; then
      echo "[ERROR] Frontend belum di-build (public/index.html tidak ada)." >&2
      echo "  Jalankan:  cd frontend && npm install && npm run build" >&2
      exit 1
    fi
    mkdir -p "$LOG_DIR"
    nohup "$PHP_BIN" -d session.save_path="$LOG_DIR" \
      -S "${HOST}:${PORT}" -t "${ROOT}/public" "${ROOT}/router.php" >> "$LOG" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 2
    if port_open; then
      echo "Aplikasi berjalan: http://${HOST}:${PORT}  (log: ${LOG})"
    else
      echo "[ERROR] Gagal menjalankan aplikasi. Cek log: ${LOG}" >&2
      exit 1
    fi
    ;;
  stop)
    if [ -f "$PID_FILE" ] && kill "$(cat "$PID_FILE")" 2>/dev/null; then
      rm -f "$PID_FILE"
      echo "Aplikasi dihentikan."
    else
      rm -f "$PID_FILE"
      echo "Tidak ada proses aplikasi yang berjalan."
    fi
    ;;
  status)
    if port_open; then
      echo "Aplikasi AKTIF di http://${HOST}:${PORT}"
    else
      echo "Aplikasi TIDAK berjalan. Jalankan: $0 start"
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|status}"
    exit 1
    ;;
esac