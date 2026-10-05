# Nightly pg_dump to DigitalOcean Spaces with 14-day retention.
# Same Postgres major version as the database, so pg_dump always matches.
FROM postgres:16-alpine
RUN apk add --no-cache aws-cli tini
COPY backup.sh restore.sh entrypoint.sh /usr/local/bin/
COPY crontab /etc/crontabs/root
RUN chmod 755 /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/entrypoint.sh
HEALTHCHECK --interval=60s --timeout=5s CMD pgrep crond > /dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
