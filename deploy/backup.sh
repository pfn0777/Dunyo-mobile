#!/bin/bash
set -Eeuo pipefail

# Encrypted off-server backups for Dunyo Mobile.
#
#   backup.sh db     Postgres dump (run nightly at 21:00 UTC / 02:00
#                     Tashkent -- see the `backup` service's crontab in
#                     docker-compose.yml).
#   backup.sh media  Tar of the media directory (run weekly, same crontab).
#
# The Postgres dump is piped directly from pg_dump into gpg -- the
# plaintext dump is NEVER written to disk, only the encrypted output is.
# Only the PUBLIC key lives on this server; the private key stays offline,
# so a stolen server or a leaked backup chat cannot decrypt anything.
#
# Destinations (at least the Telegram one is always used):
#   * Telegram: the encrypted file is sent with sendDocument to
#     $BACKUP_TELEGRAM_CHAT_ID (a private group used ONLY for backups, not the
#     shop's order group). $TELEGRAM_API_BASE defaults to the cloud Bot API
#     (50 MB upload limit); point it at a local telegram-bot-api server for
#     files up to 2 GB.
#   * rclone (optional): also copied to $RCLONE_REMOTE, with retention.
# On any failure, a Telegram message is sent to $BACKUP_TELEGRAM_CHAT_ID
# before this script exits non-zero.
#
# Runs inside the `backup` compose service (Alpine + postgresql16-client +
# gnupg + rclone + bash + curl, installed by that service's entrypoint).

mode="${1:-}"
if [ "$mode" != "db" ] && [ "$mode" != "media" ]; then
  echo "usage: backup.sh db|media" >&2
  exit 1
fi

: "${BACKUP_GPG_RECIPIENT:?BACKUP_GPG_RECIPIENT is required}"
: "${BACKUP_TELEGRAM_CHAT_ID:?BACKUP_TELEGRAM_CHAT_ID is required}"
: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN is required}"

readonly DEFAULT_TELEGRAM_API_BASE="https://api.telegram.org"
readonly TELEGRAM_API_BASE="${TELEGRAM_API_BASE:-$DEFAULT_TELEGRAM_API_BASE}"
readonly RCLONE_REMOTE="${RCLONE_REMOTE:-}"

# A dump/archive smaller than this almost certainly means pg_dump or tar
# ran against something empty or broken rather than real data -- treat
# that as a failure instead of silently uploading a useless backup.
readonly MIN_BYTES=1024
readonly RETENTION_DAYS=14
readonly WORKDIR="/tmp"
# Bot API upload limits: 50 MB on the cloud server, 2000 MB on a local one.
# Stay a little under each so multipart overhead never tips a file over.
readonly CLOUD_MAX_BYTES=$((49 * 1024 * 1024))
readonly LOCAL_MAX_BYTES=$((1990 * 1024 * 1024))
readonly UPLOAD_TIMEOUT_SEC=600

if [ "$TELEGRAM_API_BASE" = "$DEFAULT_TELEGRAM_API_BASE" ]; then
  telegram_max_bytes="$CLOUD_MAX_BYTES"
else
  telegram_max_bytes="$LOCAL_MAX_BYTES"
fi

notify_failure() {
  local exit_code=$?
  local text="Dunyo Mobile backup FAILED (mode: ${mode}, exit ${exit_code}) at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  # Best-effort: if the Telegram call itself fails, don't mask the
  # original error with a new one -- still exit with the original code.
  curl -fsS -m 15 -X POST "${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${BACKUP_TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${text}" >/dev/null 2>&1 || true
  exit "$exit_code"
}
trap notify_failure ERR

file_size() {
  stat -c%s "$1" 2>/dev/null || wc -c <"$1"
}

# Sends $1 to the backup chat. Fails (non-zero) on an HTTP error or when the
# API answers ok:false, so a rejected upload can never look like a success.
send_to_telegram() {
  local file="$1" caption="$2" response
  response="$(curl -fsS -m "$UPLOAD_TIMEOUT_SEC" \
    -F "chat_id=${BACKUP_TELEGRAM_CHAT_ID}" \
    -F "caption=${caption}" \
    -F "document=@${file}" \
    "${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/sendDocument")"
  case "$response" in
    *'"ok":true'*) ;;
    *)
      echo "error: sendDocument was not accepted: ${response}" >&2
      return 1
      ;;
  esac
}

# Delivers the encrypted file $1 (kind $2 = db|media) to every configured
# destination. A file too big for Telegram is only acceptable when rclone
# carries it; otherwise the run fails loudly instead of losing the backup.
deliver() {
  local file="$1" kind="$2" size name
  size="$(file_size "$file")"
  name="$(basename "$file")"

  if [ "$size" -lt "$MIN_BYTES" ]; then
    echo "error: encrypted ${kind} backup is only ${size} bytes (< ${MIN_BYTES}), refusing to upload" >&2
    rm -f "$file"
    return 1
  fi

  if [ "$size" -le "$telegram_max_bytes" ]; then
    send_to_telegram "$file" "${name} (${size} bytes)"
  elif [ -z "$RCLONE_REMOTE" ]; then
    echo "error: ${name} is ${size} bytes, over the Telegram limit (${telegram_max_bytes}) and RCLONE_REMOTE is not set" >&2
    rm -f "$file"
    return 1
  else
    echo "note: ${name} is over the Telegram limit, skipping Telegram (rclone only)" >&2
  fi

  if [ -n "$RCLONE_REMOTE" ]; then
    rclone copy "$file" "${RCLONE_REMOTE}/${kind}/" --checksum
    # Prune remote copies older than the retention window.
    rclone delete "${RCLONE_REMOTE}/${kind}/" --min-age "${RETENTION_DAYS}d"
  fi

  rm -f "$file"
  echo "${kind} backup ok: ${name} (${size} bytes)"
}

backup_db() {
  : "${DATABASE_URL:?DATABASE_URL is required}"

  local stamp outfile
  stamp="$(date -u +%Y%m%d-%H%M)"
  outfile="${WORKDIR}/dunyo-${stamp}.dump.gpg"

  pg_dump --format=custom --no-owner --no-privileges --schema=public "$DATABASE_URL" \
    | gpg --batch --yes --trust-model always --encrypt --recipient "$BACKUP_GPG_RECIPIENT" \
      --output "$outfile"

  deliver "$outfile" db
}

backup_media() {
  local stamp outfile
  stamp="$(date -u +%Y%m%d-%H%M)"
  outfile="${WORKDIR}/dunyo-media-${stamp}.tar.gz.gpg"

  # /srv/dunyo/media is the host directory the `api` service writes to and
  # the host Caddy serves from (see docker-compose.yml), mounted read-only here.
  tar -czf - -C / srv/dunyo/media \
    | gpg --batch --yes --trust-model always --encrypt --recipient "$BACKUP_GPG_RECIPIENT" \
      --output "$outfile"

  deliver "$outfile" media
}

case "$mode" in
  db) backup_db ;;
  media) backup_media ;;
esac
