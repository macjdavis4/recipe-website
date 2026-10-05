#!/usr/bin/env bash
# shellcheck disable=SC2015  # "check && pass || fail" is safe: pass always succeeds.
# Checks that the Droplet is set up correctly for the app, before and after the
# first deploy. Read-only. Run as your sudo user:
#
#   sudo bash verify-server.sh recipes.example.com
#
# Before the first deploy, app checks report WARN ("not deployed yet"). To test
# the database before then, add --ask-db and paste DATABASE_URL when prompted.
# Exits non-zero if any check fails. Never prints secret values.
set -uo pipefail

DOMAIN="${1:-${DOMAIN:-}}"
ASK_DB=false
[[ "${2:-}" == "--ask-db" || "${1:-}" == "--ask-db" ]] && ASK_DB=true
[[ -n $DOMAIN && $DOMAIN != --* ]] || { echo "Usage: sudo bash verify-server.sh <domain> [--ask-db]"; exit 2; }
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
DATABASE_URL_VALUE=""
if [[ -f $ENV_FILE ]]; then
  [[ $(stat -c '%U %a' "$ENV_FILE") == "$DEPLOY_USER 600" ]] && pass ".env belongs to $DEPLOY_USER with mode 600" || fail ".env should be owned by $DEPLOY_USER with mode 600"
  for key in DATABASE_URL AUTH_SECRET AUTH_URL STORAGE_DRIVER SPACES_KEY SPACES_SECRET SPACES_BUCKET SPACES_CDN_URL SPACES_ENDPOINT SPACES_REGION APP_IMAGE IMAGE_TAG; do
    [[ -n "$(env_value "$key")" ]] && pass "$key is set" || fail "$key is missing or empty"
  done
  if [[ -n "$(env_value ANTHROPIC_API_KEY)" || "$(env_value AI_PROVIDER)" == mock ]]; then pass "AI is configured"; else fail "ANTHROPIC_API_KEY is missing"; fi
  [[ "$(env_value STORAGE_DRIVER)" == spaces ]] && pass "STORAGE_DRIVER is spaces (container stays stateless)" || fail "STORAGE_DRIVER must be spaces in production"
  [[ "$(env_value AUTH_URL)" == "https://$DOMAIN" ]] && pass "AUTH_URL is https://$DOMAIN" || fail "AUTH_URL should be https://$DOMAIN"
  (( $(env_value AUTH_SECRET | wc -c) > 32 )) && pass "AUTH_SECRET is 32+ characters" || fail "AUTH_SECRET is shorter than 32 characters"
  DATABASE_URL_VALUE="$(env_value DATABASE_URL)"
elif $ASK_DB && [[ -t 0 ]]; then
  warn "No $ENV_FILE yet (written by the first deploy)"
  read -rsp "  Paste DATABASE_URL (hidden): " DATABASE_URL_VALUE
  echo
else
  warn "No $ENV_FILE yet; it is written by the first deploy (add --ask-db to test the database now)"
fi

section "Managed PostgreSQL"
if [[ -n $DATABASE_URL_VALUE ]]; then
  [[ $DATABASE_URL_VALUE == *sslmode=require* ]] && pass "DATABASE_URL requires SSL" || fail "DATABASE_URL should end with ?sslmode=require"
  # psql understands only libpq parameters, so keep just sslmode.
  SSLMODE="$(grep -oE 'sslmode=[a-z-]+' <<< "$DATABASE_URL_VALUE" | head -1)"
  PGURL="${DATABASE_URL_VALUE%%\?*}?${SSLMODE:-sslmode=require}"
  RESULT="$(docker run --rm -e PGURL="$PGURL" -e PGCONNECT_TIMEOUT=8 postgres:16-alpine \
    psql "$PGURL" -tAc "select current_user || '|' || current_database() || '|' || split_part(version(), ' ', 2) || '|' || has_schema_privilege('public', 'CREATE')" 2>&1)"
  if [[ $RESULT == *"|"*"|"*"|"* ]]; then
    IFS='|' read -r DB_USER DB_NAME DB_VERSION CAN_CREATE <<< "$(tail -1 <<< "$RESULT")"
    pass "Connected to database $DB_NAME as $DB_USER (PostgreSQL $DB_VERSION)"
    [[ $CAN_CREATE == true ]] && pass "$DB_USER can create tables in schema public (migrations will work)" || fail "$DB_USER cannot create tables in public; see the GRANT step in docs/DEPLOYMENT.md"
  elif grep -qiE 'timeout|could not connect|Connection refused' <<< "$RESULT"; then
    fail "Cannot reach the database; add this Droplet to its Trusted Sources"
  elif grep -qi 'password authentication failed' <<< "$RESULT"; then
    fail "Database rejected the username or password"
  else
    fail "Database check failed: $(tail -1 <<< "$RESULT" | cut -c1-160)"
  fi
else
  warn "Database not checked yet"
fi

section "App container"
CID="$(docker ps -q --filter label=com.docker.compose.project=larder --filter label=com.docker.compose.service=app)"
if [[ -z $CID ]]; then
  warn "App is not running yet (it starts on the first deploy)"
else
  HEALTH="$(docker inspect -f '{{.State.Health.Status}}' "$CID")"
  [[ $HEALTH == healthy ]] && pass "App container is healthy ($(docker inspect -f '{{.Config.Image}}' "$CID"))" || fail "App container health is '$HEALTH' (docker compose -f $APP_DIR/docker-compose.prod.yml logs app)"
  [[ "$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$CID")" == unless-stopped ]] && pass "Restart policy is unless-stopped" || fail "Restart policy is not unless-stopped"
  LISTEN="$(ss -Hltn 'sport = :3000' | awk '{print $4}' | sort -u | tr '\n' ' ')"
  if [[ -n $LISTEN && $LISTEN != *0.0.0.0* && $LISTEN != *"[::]"* && $LISTEN != *"*:"* ]]; then pass "Port 3000 listens on loopback only ($LISTEN)"; else fail "Port 3000 is exposed beyond loopback: $LISTEN"; fi
  curl -fsS --max-time 5 http://127.0.0.1:3000/api/health | grep -q '"status":"ok"' && pass "App answers on 127.0.0.1:3000/api/health" || fail "App does not answer locally"
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
