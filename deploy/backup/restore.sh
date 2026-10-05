#!/bin/sh
# Restores a dump into the database, replacing its contents. Uses the copy in
# /backups when it is there, otherwise downloads it from Spaces (for example on
# a rebuilt Droplet).
#   docker compose -f docker-compose.prod.yml exec backup restore.sh             # lists dumps
#   docker compose -f docker-compose.prod.yml exec backup restore.sh larder-20261004-031500.dump
# Stop the app first (docker compose stop app) so nothing writes during the restore.
set -eu
[ -f /etc/backup.env ] && . /etc/backup.env
export AWS_ACCESS_KEY_ID="${SPACES_KEY:-}" AWS_SECRET_ACCESS_KEY="${SPACES_SECRET:-}" AWS_DEFAULT_REGION="${SPACES_REGION:-us-east-1}"
PREFIX="s3://${SPACES_BACKUP_BUCKET:-}/postgres"
DIR=/backups

if [ $# -eq 0 ]; then
  echo "On this Droplet (${DIR}):"
  found=false
  for path in "$DIR"/larder-*.dump; do
    [ -e "$path" ] && found=true && echo "  $(basename "$path")"
  done
  $found || echo "  none"
  if [ -n "${SPACES_BACKUP_BUCKET:-}" ]; then
    echo "In Spaces (${PREFIX}/):"
    aws s3 ls --endpoint-url "$SPACES_ENDPOINT" "${PREFIX}/" | awk '/larder-.*\.dump$/ {print "  " $4; n++} END {if (!n) print "  none"}'
  fi
  exit 0
fi

if ! echo "$1" | grep -qE '^larder-[0-9]{8}-[0-9]{6}\.dump$'; then
  echo "Pass a dump name like larder-20261004-031500.dump" >&2
  exit 2
fi

FILE="$DIR/$1"
if [ ! -f "$FILE" ]; then
  : "${SPACES_BACKUP_BUCKET:?$1 is not in $DIR and SPACES_BACKUP_BUCKET is not set}"
  umask 077
  FILE="/tmp/$1"
  trap 'rm -f "$FILE"' EXIT
  echo "Downloading $1 from Spaces..."
  aws s3 cp --endpoint-url "$SPACES_ENDPOINT" --only-show-errors "${PREFIX}/$1" "$FILE"
fi
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$PGDATABASE" "$FILE"
echo "Restored $1 into ${PGDATABASE}."
