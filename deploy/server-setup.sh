#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 24.04 DigitalOcean Droplet. Run as root:
#
#   DEPLOY_PUBLIC_KEY="ssh-ed25519 AAAA... github-actions" bash server-setup.sh
#
# DEPLOY_PUBLIC_KEY is the public half of the key GitHub Actions uses to deploy
# (its private half goes in the DEPLOY_SSH_KEY secret). Safe to re-run.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run as root." >&2; exit 1; }
: "${DEPLOY_PUBLIC_KEY:?Set DEPLOY_PUBLIC_KEY to the public half of the deploy key}"
APP_DIR=/opt/larder

echo "==> Updating packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw unattended-upgrades fail2ban

echo "==> Installing Docker Engine and the compose plugin"
if ! command -v docker > /dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "==> Rotating container logs"
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" } }
JSON
systemctl enable --now docker
systemctl restart docker

echo "==> Creating the deploy user"
if ! id deploy > /dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
fi
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
grep -qxF "$DEPLOY_PUBLIC_KEY" /home/deploy/.ssh/authorized_keys 2> /dev/null ||
  echo "$DEPLOY_PUBLIC_KEY" >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
install -d -m 750 -o deploy -g deploy "$APP_DIR"

echo "==> Hardening SSH (keys only)"
cat > /etc/ssh/sshd_config.d/99-larder.conf <<'SSH'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
SSH
systemctl reload ssh || systemctl reload sshd

echo "==> Firewall: SSH, HTTP, HTTPS only"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "==> Swap (2 GB) for small Droplets"
if ! swapon --show | grep -q '^/swapfile'; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Automatic security updates"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo
echo "Done. Next: point your domain's A record at this Droplet, add the GitHub"
echo "Actions secrets (see README), and merge to main to deploy into $APP_DIR."
