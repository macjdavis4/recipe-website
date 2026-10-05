#!/bin/sh
# Dumps the database to /backups (./backups on the Droplet), copies the dump to
# the private Spaces bucket SPACES_BACKUP_BUCKET, then deletes dumps older than
# BACKUP_RETENTION_DAYS (default 14) in both places. The Spaces copy is what
# survives losing the Droplet, so a failed upload fails the whole run.
#
#   docker compose -f docker-compose.prod.yml exec backup backup.sh          # back up now
#   docker compose -f docker-compose.prod.yml exec backup backup.sh --check  # test Spaces access
set -eu
[ -f /etc/backup.env ] && . /etc/backup.env

: "${SPACES_BACKUP_BUCKET:?SPACES_BACKUP_BUCKET is not set}"
: "${SPACES_ENDPOINT:?SPACES_ENDPOINT is not set}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
export AWS_ACCESS_KEY_ID="${SPACES_KEY:?SPACES_KEY is not set}"
export AWS_SECRET_ACCESS_KEY="${SPACES_SECRET:?SPACES_SECRET is not set}"
export AWS_DEFAULT_REGION="${SPACES_REGION:-us-east-1}"
PREFIX="s3://${SPACES_BACKUP_BUCKET}/postgres"
DIR=/backups
s3() { aws s3 --endpoint-url "$SPACES_ENDPOINT" --only-show-errors "$@"; }
log() { echo "[$(date -u +%FT%TZ)] $*"; }

if [ "${1:-}" = "--check" ]; then
  # Fails on bad credentials or a missing bucket; refuses a public bucket.
  acl="$(aws s3api get-bucket-acl --endpoint-url "$SPACES_ENDPOINT" --bucket "$SPACES_BACKUP_BUCKET" --output text)"
  if echo "$acl" | grep -q "AllUsers"; then
    echo "Bucket ${SPACES_BACKUP_BUCKET} is public. Make it private before storing database dumps in it." >&2
    exit 2
  fi
  latest="$(aws s3 ls --endpoint-url "$SPACES_ENDPOINT" "${PREFIX}/" | awk '{print $4}' | grep '^larder-.*\.dump$' | sort | tail -n 1 || true)"
  echo "Spaces OK: ${SPACES_BACKUP_BUCKET} is private. Latest copy: ${latest:-none yet}"
  exit 0
fi

umask 077
mkdir -p "$DIR"
NAME="larder-$(date -u +%Y%m%d-%H%M%S).dump"
trap 'rm -f "$DIR/$NAME.partial"' EXIT

log "Dumping ${PGDATABASE}..."
pg_dump --format=custom --no-owner --no-privileges --file="$DIR/$NAME.partial"
mv "$DIR/$NAME.partial" "$DIR/$NAME"
log "Saved $DIR/$NAME ($(du -h "$DIR/$NAME" | cut -f1)). Uploading to ${PREFIX}/"
s3 cp "$DIR/$NAME" "${PREFIX}/${NAME}"

CUTOFF="$(date -u -d "@$(( $(date +%s) - RETENTION_DAYS * 86400 ))" +%Y%m%d)"
day_of() { echo "$1" | sed -n 's/^larder-\([0-9]\{8\}\)-[0-9]\{6\}\.dump$/\1/p'; }
for path in "$DIR"/larder-*.dump; do
  [ -e "$path" ] || continue
  day="$(day_of "$(basename "$path")")"
  if [ -n "$day" ] && [ "$day" -lt "$CUTOFF" ]; then
    log "Pruning local $(basename "$path")"
    rm -f "$path"
  fi
done
aws s3 ls --endpoint-url "$SPACES_ENDPOINT" "${PREFIX}/" | awk '{print $4}' | while read -r key; do
  day="$(day_of "$key")"
  if [ -n "$day" ] && [ "$day" -lt "$CUTOFF" ]; then
    log "Pruning Spaces ${key}"
    s3 rm "${PREFIX}/${key}"
  fi
done
log "Backup complete."
