#!/usr/bin/env bash
# shellcheck disable=SC2015  # "check && pass || fail" is safe: pass always succeeds.
# Checks that the Droplet is set up correctly for the app, before and after the
# first deploy. Read-only. Run as your sudo user:
#
#   sudo bash verify-server.sh recipes.example.com
#
# Before the first deploy, the settings, container, and backup checks report
# WARN ("not deployed yet"). Run it again after the first deploy.
# Exits non-zero if any check fails. Never prints secret values.
set -uo pipefail

DOMAIN="${1:-${DOMAIN:-}}"
[[ -n $DOMAIN && $DOMAIN != --* ]] || { echo "Usage: sudo bash verify-server.sh <domain>"; exit 2; }
[[ $EUID -eq 0 ]] || { echo "Run with sudo."; exit 2; }

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR=/opt/larder
ENV_FILE="$APP_DIR/.env"
PASS=0 WARN=0 FAIL=0
pass() { echo "  [PASS] $*"; PASS=$((PASS + 1)); }
warn() { echo "  [WARN] $*"; WARN=$((WARN + 1)); }
fail() { echo "  [FAIL] $*"; FAIL=$((FAIL + 1)); }
section() { echo -e "\n== $*"; }
env_value() { grep -E "^$1=" "$ENV_FILE" 2> /dev/null | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"\s*(#.*)?$/\1/; s/^'"'"'(.*)'"'"'$/\1/'; }

section "Docker"
if systemctl is-active --quiet docker; then pass "Docker is running ($(docker --version | cut -d, -f1))"; else fail "Docker is not running"; fi
if docker compose version > /dev/null 2>&1; then pass "Compose plugin $(docker compose version --short)"; else fail "docker compose plugin missing"; fi
if systemctl is-enabled --quiet docker; then pass "Docker starts on boot"; else fail "Docker is not enabled on boot (systemctl enable docker)"; fi

section "Deploy user and SSH"
if id "$DEPLOY_USER" > /dev/null 2>&1; then
  pass "User $DEPLOY_USER exists"
  if id -nG "$DEPLOY_USER" | tr ' ' '\n' | grep -qx docker; then pass "$DEPLOY_USER is in the docker group"; else fail "$DEPLOY_USER is not in the docker group"; fi
  if id -nG "$DEPLOY_USER" | tr ' ' '\n' | grep -qxE 'sudo|admin|wheel'; then fail "$DEPLOY_USER should not have sudo"; else pass "$DEPLOY_USER has no sudo"; fi
  KEYS="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)/.ssh/authorized_keys"
  if [[ -s $KEYS ]] && grep -q 'ssh-' "$KEYS"; then pass "$DEPLOY_USER has an authorized SSH key"; else fail "No SSH key for $DEPLOY_USER (re-run server-setup.sh)"; fi
  ALLOW="$(sshd -T -C "user=$DEPLOY_USER,host=github.com,addr=192.0.2.1" 2> /dev/null | awk '/^allowusers /{print $2}')"
  if [[ -z $ALLOW ]] || grep -qw "$DEPLOY_USER" <<< "$ALLOW"; then pass "sshd lets $DEPLOY_USER log in"; else fail "sshd AllowUsers does not include $DEPLOY_USER"; fi
  if sshd -T 2> /dev/null | grep -qx 'passwordauthentication no'; then pass "SSH password logins are off"; else warn "SSH password logins are on"; fi
else
  fail "User $DEPLOY_USER does not exist (run server-setup.sh)"
fi
if [[ -d $APP_DIR && $(stat -c %U "$APP_DIR") == "$DEPLOY_USER" ]]; then pass "$APP_DIR exists and belongs to $DEPLOY_USER"; else fail "$APP_DIR missing or not owned by $DEPLOY_USER"; fi

section "Firewall"
UFW="$(ufw status verbose 2> /dev/null)"
if grep -q "Status: active" <<< "$UFW"; then pass "ufw is active"; else fail "ufw is not active"; fi
if grep -qE '^(80,443/tcp|Nginx Full|80/tcp|443/tcp)' <<< "$UFW"; then pass "HTTP/HTTPS are allowed"; else fail "ufw does not allow HTTP/HTTPS (ufw allow 'Nginx Full')"; fi
if grep -qE '^3000' <<< "$UFW"; then fail "ufw opens port 3000; the app must stay private (ufw delete allow 3000)"; else pass "Port 3000 is not opened in ufw"; fi

section "DNS and nginx"
PUBLIC_IP="$(curl -fsS --max-time 3 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address 2> /dev/null || true)"
DNS_IPS="$(dig +short A "$DOMAIN" | tr '\n' ' ')"
if [[ -n $PUBLIC_IP && " $DNS_IPS " == *" $PUBLIC_IP "* ]]; then pass "$DOMAIN points at this Droplet ($PUBLIC_IP)"; else fail "$DOMAIN resolves to '${DNS_IPS:-nothing}', expected ${PUBLIC_IP:-this Droplet}"; fi
if systemctl is-active --quiet nginx; then pass "nginx is running"; else fail "nginx is not running"; fi
if nginx -t > /dev/null 2>&1; then pass "nginx config is valid"; else fail "nginx -t reports errors"; fi
SITE=/etc/nginx/sites-enabled/larder.conf
if [[ -e $SITE ]]; then
  pass "Site is enabled ($SITE)"
  grep -q "server_name $DOMAIN;" "$SITE" && pass "Site serves $DOMAIN" || fail "Site does not list server_name $DOMAIN"
  grep -q "server 127.0.0.1:3000;" "$SITE" && pass "Site proxies to 127.0.0.1:3000" || fail "Site does not proxy to 127.0.0.1:3000"
  grep -q "proxy_buffering off;" "$SITE" && pass "AI streaming is unbuffered" || fail "proxy_buffering off missing for /api/ai/"
  grep -q "managed by Certbot" "$SITE" && pass "Certbot manages HTTPS for the site" || fail "No Certbot HTTPS block (re-run server-setup.sh after DNS works)"
else
  fail "$SITE is missing (run server-setup.sh)"
fi
CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [[ -f $CERT ]]; then
  END="$(openssl x509 -enddate -noout -in "$CERT" | cut -d= -f2)"
  DAYS=$((($(date -d "$END" +%s) - $(date +%s)) / 86400))
  if ((DAYS > 14)); then pass "Certificate valid for $DAYS more days"; else warn "Certificate expires in $DAYS days"; fi
else
  fail "No certificate at $CERT"
fi
if systemctl is-active --quiet certbot.timer; then pass "Certificate auto-renewal timer is on"; else warn "certbot.timer is not active"; fi

section "Production settings ($ENV_FILE)"
if [[ -f $ENV_FILE ]]; then
  [[ $(stat -c '%U %a' "$ENV_FILE") == "$DEPLOY_USER 600" ]] && pass ".env belongs to $DEPLOY_USER with mode 600" || fail ".env should be owned by $DEPLOY_USER with mode 600"
  for key in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB AUTH_SECRET AUTH_URL STORAGE_DRIVER SPACES_KEY SPACES_SECRET SPACES_BUCKET SPACES_CDN_URL SPACES_ENDPOINT SPACES_REGION SPACES_BACKUP_BUCKET APP_IMAGE IMAGE_TAG; do
    [[ -n "$(env_value "$key")" ]] && pass "$key is set" || fail "$key is missing or empty"
  done
  if [[ -n "$(env_value ANTHROPIC_API_KEY)" || "$(env_value AI_PROVIDER)" == mock ]]; then pass "AI is configured"; else fail "ANTHROPIC_API_KEY is missing"; fi
  [[ "$(env_value STORAGE_DRIVER)" == spaces ]] && pass "STORAGE_DRIVER is spaces (container stays stateless)" || fail "STORAGE_DRIVER must be spaces in production"
  [[ "$(env_value AUTH_URL)" == "https://$DOMAIN" ]] && pass "AUTH_URL is https://$DOMAIN" || fail "AUTH_URL should be https://$DOMAIN"
  (( $(env_value AUTH_SECRET | wc -c) > 32 )) && pass "AUTH_SECRET is 32+ characters" || fail "AUTH_SECRET is shorter than 32 characters"
  (( $(env_value POSTGRES_PASSWORD | wc -c) > 24 )) && pass "POSTGRES_PASSWORD is 24+ characters" || fail "POSTGRES_PASSWORD is shorter than 24 characters"
  [[ "$(env_value POSTGRES_PASSWORD)" =~ ^[A-Za-z0-9]+$ ]] && pass "POSTGRES_PASSWORD is URL-safe" || fail "POSTGRES_PASSWORD should be letters and digits only (openssl rand -hex 24)"
  [[ -n "$(env_value RESEND_API_KEY)" && -n "$(env_value EMAIL_FROM)" ]] && pass "Email is configured (password reset works)" || fail "RESEND_API_KEY and EMAIL_FROM are needed for password reset emails"
  if [[ -n "$(env_value SPACES_BACKUP_BUCKET)" && "$(env_value SPACES_BACKUP_BUCKET)" == "$(env_value SPACES_BUCKET)" ]]; then
    fail "SPACES_BACKUP_BUCKET must be a separate private bucket, not the public image bucket"
  fi
else
  warn "No $ENV_FILE yet; it is written by the first deploy"
fi

container() { docker ps -q --filter label=com.docker.compose.project=larder --filter "label=com.docker.compose.service=$1"; }
check_container() { # name, container id
  local health
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$2")"
  [[ $health == healthy ]] && pass "$1 container is healthy ($(docker inspect -f '{{.Config.Image}}' "$2"))" || fail "$1 container health is '$health' (dc logs $1)"
  [[ "$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$2")" == unless-stopped ]] && pass "$1 restart policy is unless-stopped" || fail "$1 restart policy is not unless-stopped"
}

section "App container"
CID="$(container app)"
if [[ -z $CID ]]; then
  warn "App is not running yet (it starts on the first deploy)"
else
  check_container app "$CID"
  LISTEN="$(ss -Hltn 'sport = :3000' | awk '{print $4}' | sort -u | tr '\n' ' ')"
  if [[ -n $LISTEN && $LISTEN != *0.0.0.0* && $LISTEN != *"[::]"* && $LISTEN != *"*:"* ]]; then pass "Port 3000 listens on loopback only ($LISTEN)"; else fail "Port 3000 is exposed beyond loopback: $LISTEN"; fi
  curl -fsS --max-time 5 http://127.0.0.1:3000/api/health | grep -q '"status":"ok"' && pass "App answers on 127.0.0.1:3000/api/health" || fail "App does not answer locally"
fi

section "PostgreSQL"
DB_CID="$(container db)"
if [[ -z $DB_CID ]]; then
  warn "Database is not running yet (it starts on the first deploy)"
else
  check_container db "$DB_CID"
  [[ -z "$(docker port "$DB_CID")" ]] && pass "Postgres publishes no ports (internal network only)" || fail "Postgres publishes ports: $(docker port "$DB_CID" | tr '\n' ' ')"
  ss -Hltn 'sport = :5432' | grep -q . && fail "Something listens on port 5432 on the host" || pass "Nothing listens on port 5432 on the host"
  VOLUME="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Type}}:{{.Name}}{{end}}{{end}}' "$DB_CID")"
  [[ $VOLUME == volume:* ]] && pass "Data is on the Docker volume ${VOLUME#volume:}" || fail "Postgres data is not on a named volume"
  # shellcheck disable=SC2016  # $POSTGRES_* expand inside the container.
  SIZE="$(docker exec "$DB_CID" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select pg_size_pretty(pg_database_size(current_database())) || \$\$|\$\$ || count(*) from \"_prisma_migrations\" where finished_at is not null"' 2> /dev/null)"
  if [[ $SIZE == *"|"* ]]; then pass "Database answers (${SIZE%%|*}, ${SIZE##*|} migrations applied)"; else fail "Could not query the database (dc logs db)"; fi
fi

section "Backups"
BACKUP_CID="$(container backup)"
BACKUP_DIR="$APP_DIR/backups"
if [[ -z $BACKUP_CID ]]; then
  warn "Backup service is not running yet (it starts on the first deploy)"
else
  check_container backup "$BACKUP_CID"
  CHECK="$(docker exec "$BACKUP_CID" backup.sh --check 2>&1)"
  if [[ $? -eq 0 ]]; then pass "$(tail -1 <<< "$CHECK")"; else fail "Spaces backup bucket check failed: $(tail -1 <<< "$CHECK" | cut -c1-200)"; fi
  [[ $(stat -c '%a' "$BACKUP_DIR" 2> /dev/null) == 700 ]] && pass "$BACKUP_DIR is private (mode 700)" || fail "$BACKUP_DIR should exist with mode 700"
  LATEST="$(find "$BACKUP_DIR" -maxdepth 1 -name 'larder-*.dump' -size +0 -printf '%T@ %f\n' 2> /dev/null | sort -n | tail -1)"
  if [[ -z $LATEST ]]; then
    warn "No dump yet; the first runs at 03:15 UTC (or now: dc exec backup backup.sh)"
  else
    AGE_HOURS=$((($(date +%s) - ${LATEST%%.*}) / 3600))
    if ((AGE_HOURS < 36)); then pass "Latest dump ${LATEST#* } is ${AGE_HOURS}h old"; else fail "Latest dump ${LATEST#* } is ${AGE_HOURS}h old; nightly backups are not running (dc logs backup)"; fi
    if [[ $CHECK == *"Latest copy: ${LATEST#* }"* ]]; then pass "Latest dump is also in Spaces"; else fail "Latest dump ${LATEST#* } is not in Spaces; the upload failed (dc exec backup backup.sh)"; fi
  fi
fi

section "Public site"
HEADERS="$(curl -sS -o /dev/null -D - --max-time 10 "https://$DOMAIN/" 2>&1)"
if grep -qiE '^HTTP/[0-9.]+ 200' <<< "$HEADERS"; then
  pass "https://$DOMAIN/ loads with a trusted certificate"
  for header in strict-transport-security content-security-policy x-content-type-options x-frame-options; do
    grep -qi "^$header:" <<< "$HEADERS" && pass "Header $header is set" || fail "Header $header is missing"
  done
  grep -qi '^x-powered-by:' <<< "$HEADERS" && fail "X-Powered-By header leaks" || pass "No X-Powered-By header"
elif [[ -n $CID ]]; then
  fail "https://$DOMAIN/ did not return 200: $(head -1 <<< "$HEADERS")"
else
  warn "https://$DOMAIN/ not checked (app not deployed yet)"
fi
if [[ -n $CID ]]; then
  curl -fsS --max-time 10 "https://$DOMAIN/api/health" | grep -q '"db":"ok"' && pass "https://$DOMAIN/api/health reports the database ok" || fail "Public health check failed"
fi
REDIRECT="$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 10 "http://$DOMAIN/")"
[[ $REDIRECT =~ ^30[178]\ https:// ]] && pass "HTTP redirects to HTTPS" || warn "HTTP does not redirect to HTTPS ($REDIRECT)"

echo -e "\nResult: $PASS passed, $WARN warnings, $FAIL failed"
((FAIL == 0)) || exit 1
