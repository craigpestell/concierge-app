#!/bin/sh
# Prepares an Ubuntu droplet to run the site and installs pull deploys. Safe to run again:
# the Droplet setup workflow runs it each time, so a fresh droplet needs no manual setup.
set -eu

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

# 2 GB of swap so a 1 GB droplet has room for Postgres, the app and Caddy.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Firewall: SSH and web only. The database is never exposed.
if command -v ufw >/dev/null && ! ufw status | grep -q "Status: active"; then
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi

mkdir -p /opt/concierge/deploy /opt/concierge/backups

# jq reads the GitHub API in the pull deploy script.
if ! command -v jq >/dev/null; then
  apt-get update -qq
  apt-get install -y -qq jq >/dev/null
fi

# Pull deploys: the droplet checks main every 5 minutes and deploys green commits itself.
# The workflow copies these files to /opt/concierge/deploy/ before running this script.
if [ -f /opt/concierge/deploy/pull-deploy.sh ]; then
  install -m 0755 /opt/concierge/deploy/pull-deploy.sh /usr/local/sbin/concierge-deploy
  install -m 0644 /opt/concierge/deploy/concierge-deploy.service /opt/concierge/deploy/concierge-deploy.timer /etc/systemd/system/
  mkdir -p /etc/concierge-deploy
  chmod 700 /etc/concierge-deploy
  systemctl daemon-reload
  systemctl enable --now concierge-deploy.timer
fi
