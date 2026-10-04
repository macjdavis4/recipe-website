#!/bin/sh
# Restores a backup from Spaces into the database, replacing its contents.
#   docker compose -f docker-compose.prod.yml exec backup restore.sh             # lists backups
#   docker compose -f docker-compose.prod.yml exec backup restore.sh larder-20261004-031500.dump
# Stop the app first (docker compose stop app) so nothing writes during the restore.
set -eu
[ -f /etc/backup.env ] && . /etc/backup.env
export AWS_ACCESS_KEY_ID="$SPACES_KEY" AWS_SECRET_ACCESS_KEY="$SPACES_SECRET" AWS_DEFAULT_REGION="${SPACES_REGION:-us-east-1}"
PREFIX="s3://${SPACES_BACKUP_BUCKET}/postgres"

if [ $# -eq 0 ]; then
  aws s3 ls --endpoint-url "$SPACES_ENDPOINT" "${PREFIX}/"
  exit 0
fi

FILE="/tmp/restore.dump"
trap 'rm -f "$FILE"' EXIT
aws s3 cp --endpoint-url "$SPACES_ENDPOINT" --only-show-errors "${PREFIX}/$1" "$FILE"
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$PGDATABASE" "$FILE"
echo "Restored $1 into ${PGDATABASE}."
