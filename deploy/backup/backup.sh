#!/bin/sh
# Dumps the database and uploads it to Spaces, then deletes backups older than
# BACKUP_RETENTION_DAYS (default 14). Run by hand with:
#   docker compose -f docker-compose.prod.yml exec backup backup.sh
set -eu
[ -f /etc/backup.env ] && . /etc/backup.env

: "${SPACES_BACKUP_BUCKET:?SPACES_BACKUP_BUCKET is not set}"
: "${SPACES_ENDPOINT:?SPACES_ENDPOINT is not set}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
export AWS_ACCESS_KEY_ID="${SPACES_KEY:?SPACES_KEY is not set}"
export AWS_SECRET_ACCESS_KEY="${SPACES_SECRET:?SPACES_SECRET is not set}"
export AWS_DEFAULT_REGION="${SPACES_REGION:-us-east-1}"
PREFIX="s3://${SPACES_BACKUP_BUCKET}/postgres"
s3() { aws s3 --endpoint-url "$SPACES_ENDPOINT" --only-show-errors "$@"; }

STAMP="$(date -u +%Y%m%d-%H%M%S)"
FILE="/tmp/larder-${STAMP}.dump"
trap 'rm -f "$FILE"' EXIT

echo "[$(date -u +%FT%TZ)] Dumping ${PGDATABASE}..."
pg_dump --format=custom --no-owner --no-privileges --file="$FILE"
echo "Uploading $(du -h "$FILE" | cut -f1) to ${PREFIX}/larder-${STAMP}.dump"
s3 cp "$FILE" "${PREFIX}/larder-${STAMP}.dump"

CUTOFF="$(date -u -d "@$(( $(date +%s) - RETENTION_DAYS * 86400 ))" +%Y%m%d)"
aws s3 ls --endpoint-url "$SPACES_ENDPOINT" "${PREFIX}/" | awk '{print $4}' | while read -r key; do
  day="$(echo "$key" | sed -n 's/^larder-\([0-9]\{8\}\)-[0-9]\{6\}\.dump$/\1/p')"
  if [ -n "$day" ] && [ "$day" -lt "$CUTOFF" ]; then
    echo "Pruning ${key} (older than ${RETENTION_DAYS} days)"
    s3 rm "${PREFIX}/${key}"
  fi
done
echo "[$(date -u +%FT%TZ)] Backup complete."
