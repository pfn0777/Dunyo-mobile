#!/bin/bash
set -euo pipefail

# Encrypted off-server backups for Dunyo Mobile.
#
#   backup.sh db     Postgres dump (run nightly at 21:00 UTC / 02:00
#                     Tashkent -- see the `backup` service's crontab in
#                     docker-compose.yml).
#   backup.sh media  Tar of the media volume (run weekly, same crontab).
#
# The Postgres dump is piped directly from pg_dump into gpg -- the
# plaintext dump is NEVER written to disk, only the encrypted output is.
# On any failure (dump, encrypt, size check, or upload), a Telegram
# message is sent to $BACKUP_TELEGRAM_CHAT_ID before this script exits
# non-zero.
#
# Runs inside the `backup` compose service (Alpine + postgresql16-client +
# gnupg + rclone + bash + curl, installed by that service's entrypoint).

mode="${1:-}"
if [ "$mode" != "db" ] && [ "$mode" != "media" ]; then
  echo "usage: backup.sh db|media" >&2
  exit 1
fi

: "${BACKUP_GPG_RECIPIENT:?BACKUP_GPG_RECIPIENT is required}"
: "${RCLONE_REMOTE:?RCLONE_REMOTE is required}"
: "${BACKUP_TELEGRAM_CHAT_ID:?BACKUP_TELEGRAM_CHAT_ID is required}"
: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN is required}"

# A dump/archive smaller than this almost certainly means pg_dump or tar
# ran against something empty or broken rather than real data -- treat
# that as a failure instead of silently uploading a useless backup.
readonly MIN_BYTES=1024
readonly RETENTION_DAYS=14
readonly WORKDIR="/tmp"

notify_failure() {
  local exit_code=$?
  local text="Dunyo Mobile backup FAILED (mode: ${mode}, exit ${exit_code}) at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  # Best-effort: if the Telegram call itself fails, don't mask the
  # original error with a new one -- still exit with the original code.
  curl -fsS -m 15 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${BACKUP_TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${text}" >/dev/null 2>&1 || true
  exit "$exit_code"
}
trap notify_failure ERR

file_size() {
  stat -c%s "$1" 2>/dev/null || wc -c <"$1"
}

backup_db() {
  : "${DATABASE_URL:?DATABASE_URL is required}"

  local stamp outfile size
  stamp="$(date -u +%Y%m%d-%H%M)"
  outfile="${WORKDIR}/dunyo-${stamp}.dump.gpg"

  pg_dump --format=custom --no-owner --no-privileges --schema=public "$DATABASE_URL" \
    | gpg --batch --yes --trust-model always --encrypt --recipient "$BACKUP_GPG_RECIPIENT" \
      --output "$outfile"

  size="$(file_size "$outfile")"
  if [ "$size" -lt "$MIN_BYTES" ]; then
    echo "error: encrypted dump is only ${size} bytes (< ${MIN_BYTES}), refusing to upload" >&2
    rm -f "$outfile"
    exit 1
  fi

  rclone copy "$outfile" "${RCLONE_REMOTE}/db/" --checksum
  rm -f "$outfile"

  # Prune remote DB dumps older than the retention window.
  rclone delete "${RCLONE_REMOTE}/db/" --min-age "${RETENTION_DAYS}d"

  echo "db backup ok: dunyo-${stamp}.dump.gpg (${size} bytes)"
}

backup_media() {
  local stamp outfile size
  stamp="$(date -u +%Y%m%d-%H%M)"
  outfile="${WORKDIR}/dunyo-media-${stamp}.tar.gz.gpg"

  # /srv/dunyo/media is the same named volume the `api` service writes to
  # and Caddy serves from (see docker-compose.yml), mounted read-only here.
  tar -czf - -C / srv/dunyo/media \
    | gpg --batch --yes --trust-model always --encrypt --recipient "$BACKUP_GPG_RECIPIENT" \
      --output "$outfile"

  size="$(file_size "$outfile")"
  if [ "$size" -lt "$MIN_BYTES" ]; then
    echo "error: encrypted media archive is only ${size} bytes (< ${MIN_BYTES}), refusing to upload" >&2
    rm -f "$outfile"
    exit 1
  fi

  rclone copy "$outfile" "${RCLONE_REMOTE}/media/" --checksum
  rm -f "$outfile"

  rclone delete "${RCLONE_REMOTE}/media/" --min-age "${RETENTION_DAYS}d"

  echo "media backup ok: dunyo-media-${stamp}.tar.gz.gpg (${size} bytes)"
}

case "$mode" in
  db) backup_db ;;
  media) backup_media ;;
esac
