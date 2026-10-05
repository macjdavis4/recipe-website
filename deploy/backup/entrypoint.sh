#!/bin/sh
# busybox crond does not pass the container environment to jobs, so save the
# settings the backup needs to a root-only file that backup.sh reads.
set -eu
umask 077
: > /etc/backup.env
for name in PGHOST PGUSER PGPASSWORD PGDATABASE SPACES_KEY SPACES_SECRET SPACES_REGION SPACES_ENDPOINT SPACES_BACKUP_BUCKET BACKUP_RETENTION_DAYS BACKUP_PING_URL; do
  value="$(printenv "$name" || true)"
  printf "export %s='%s'\n" "$name" "$(printf '%s' "$value" | sed "s/'/'\\\\''/g")" >> /etc/backup.env
done
echo "Backup scheduler started. Next run at 03:15 UTC."
exec crond -f -l 8
