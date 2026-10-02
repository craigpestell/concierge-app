#!/bin/sh
# Prepares an Ubuntu droplet to run the site. Safe to run again: the deploy
# workflow runs it on every deploy, so a fresh droplet needs no manual setup.
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
