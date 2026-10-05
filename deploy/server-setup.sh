#!/usr/bin/env bash
# One-time setup of an existing Droplet (Ubuntu 24.04 with Docker, nginx,
# Certbot, ufw, and key-only SSH already installed) for this app.
# Run as your sudo user from the folder holding this script and
# nginx/larder.conf.template:
#
#   sudo DOMAIN=recipes.example.com CERTBOT_EMAIL=you@example.com \
#        DEPLOY_PUBLIC_KEY="$(cat larder-deploy.pub)" bash server-setup.sh
#
# It creates a restricted `deploy` user for GitHub Actions, allows it in
# sshd's AllowUsers, creates /opt/larder, installs the nginx site, and gets an
# HTTPS certificate. Safe to re-run.
set -Eeuo pipefail
trap 'echo "[ERROR] line $LINENO: $BASH_COMMAND" >&2' ERR

: "${DOMAIN:?Set DOMAIN, e.g. DOMAIN=recipes.example.com}"
: "${CERTBOT_EMAIL:?Set CERTBOT_EMAIL for certificate expiry notices}"
: "${DEPLOY_PUBLIC_KEY:?Set DEPLOY_PUBLIC_KEY to the public half of the GitHub Actions deploy key}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR=/opt/larder
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$HERE/nginx/larder.conf.template"
SITE=/etc/nginx/sites-available/larder.conf

step() { echo -e "\n==> $*"; }
die() { echo "[FAIL] $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo."
[[ -f $TEMPLATE ]] || die "Missing $TEMPLATE. Copy the whole deploy/ folder to the server."
[[ $DEPLOY_PUBLIC_KEY == ssh-* ]] || die "DEPLOY_PUBLIC_KEY does not look like an SSH public key."

step "Checking prerequisites"
for cmd in docker nginx certbot ufw sshd dig curl; do
  command -v "$cmd" > /dev/null || die "$cmd is not installed."
done
docker compose version > /dev/null 2>&1 || die "The docker compose plugin is not installed."
systemctl is-active --quiet docker || die "Docker is not running."
systemctl is-active --quiet nginx || die "nginx is not running."
echo "Docker, compose, nginx, Certbot, and ufw are present."

step "Creating the $DEPLOY_USER user (no sudo, docker group only)"
if ! id "$DEPLOY_USER" > /dev/null 2>&1; then
  adduser --disabled-password --gecos "GitHub Actions deploys" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_HOME/.ssh"
# The key may only run commands: no forwarding, no interactive terminal.
KEY_LINE="no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty $DEPLOY_PUBLIC_KEY"
touch "$DEPLOY_HOME/.ssh/authorized_keys"
grep -qxF "$KEY_LINE" "$DEPLOY_HOME/.ssh/authorized_keys" || echo "$KEY_LINE" >> "$DEPLOY_HOME/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh/authorized_keys"
chmod 600 "$DEPLOY_HOME/.ssh/authorized_keys"

step "Allowing $DEPLOY_USER through sshd's AllowUsers"
mapfile -t ALLOW_FILES < <(grep -lE '^\s*AllowUsers' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2> /dev/null || true)
if [[ ${#ALLOW_FILES[@]} -eq 0 ]]; then
  echo "No AllowUsers rule found; nothing to change."
else
  for file in "${ALLOW_FILES[@]}"; do
    if grep -qE "^\s*AllowUsers\b.*\b${DEPLOY_USER}\b" "$file"; then
      echo "$file already allows $DEPLOY_USER."
      continue
    fi
    cp -p "$file" "$file.bak-larder"
    sed -i -E "s/^(\s*AllowUsers\b.*)$/\1 ${DEPLOY_USER}/" "$file"
    if sshd -t; then
      echo "Added $DEPLOY_USER to AllowUsers in $file."
    else
      mv "$file.bak-larder" "$file"
      die "sshd rejected the change; restored $file."
    fi
  done
  systemctl reload ssh || systemctl reload sshd
fi

step "Creating $APP_DIR"
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR/backups"

step "Installing the nginx site for $DOMAIN"
if [[ -f $SITE ]] && grep -q "managed by Certbot" "$SITE" && [[ ${FORCE_NGINX:-0} != 1 ]]; then
  echo "$SITE already has Certbot's HTTPS settings; leaving it alone (FORCE_NGINX=1 to replace)."
else
  sed "s/__DOMAIN__/${DOMAIN}/g" "$TEMPLATE" > "$SITE"
fi
ln -sfn "$SITE" /etc/nginx/sites-enabled/larder.conf
nginx -t
systemctl reload nginx

step "Checking that DNS for $DOMAIN points at this Droplet"
PUBLIC_IP="$(curl -fsS --max-time 3 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address || true)"
DNS_IPS="$(dig +short A "$DOMAIN" | tr '\n' ' ')"
if [[ -z $PUBLIC_IP || " $DNS_IPS " != *" $PUBLIC_IP "* ]]; then
  echo "[WARN] $DOMAIN resolves to '${DNS_IPS:-nothing}', but this Droplet is ${PUBLIC_IP:-unknown}."
  echo "       Fix the A record, wait for it to update, then re-run this script for HTTPS."
  exit 0
fi
echo "$DOMAIN -> $PUBLIC_IP"

step "Getting an HTTPS certificate"
certbot --nginx -d "$DOMAIN" --redirect --agree-tos -m "$CERTBOT_EMAIL" -n --keep-until-expiring
nginx -t
systemctl reload nginx
systemctl is-active --quiet certbot.timer && echo "Automatic renewal is on (certbot.timer)."

echo -e "\nDone. Next: add the GitHub secrets (docs/DEPLOYMENT.md), push to main, then run verify-server.sh."
