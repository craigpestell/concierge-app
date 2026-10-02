#!/usr/bin/env bash
# Creates the droplet, its SSH key and its firewall with doctl, then stores the
# deploy settings as GitHub secrets and starts the first deploy. Safe to re-run:
# anything that already exists is left alone.
#
#   ./deploy/create-droplet.sh
#
# Needs: doctl (signed in with `doctl auth init`). Optional: gh (signed in), to set
# the GitHub secrets and start the deploy for you. Set DOCTL if yours has another name.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=deploy/droplet.env
source "$here/droplet.env"
DOCTL="${DOCTL:-doctl}"

say() { printf '\n==> %s\n' "$*"; }

command -v "$DOCTL" >/dev/null || { echo "doctl not found. Install it or set DOCTL to its name." >&2; exit 1; }
"$DOCTL" account get >/dev/null || { echo "doctl isn't signed in. Run: $DOCTL auth init" >&2; exit 1; }

say "SSH key"
if [ ! -f "$SSH_KEY_FILE" ]; then
  ssh-keygen -t ed25519 -f "$SSH_KEY_FILE" -C "$SSH_KEY_NAME" -N ""
fi
fingerprint="$(ssh-keygen -l -E md5 -f "$SSH_KEY_FILE.pub" | awk '{print $2}' | sed 's/^MD5://')"
if "$DOCTL" compute ssh-key get "$fingerprint" >/dev/null 2>&1; then
  echo "Already in DigitalOcean: $fingerprint"
else
  "$DOCTL" compute ssh-key import "$SSH_KEY_NAME" --public-key-file "$SSH_KEY_FILE.pub" >/dev/null
  echo "Added to DigitalOcean: $fingerprint"
fi

say "Droplet"
if "$DOCTL" compute droplet list --tag-name "$TAG" --format Name --no-header | grep -qx "$DROPLET_NAME"; then
  echo "Already exists: $DROPLET_NAME"
else
  extra=()
  [ "$ENABLE_BACKUPS" = "true" ] && extra+=(--enable-backups)
  "$DOCTL" compute droplet create "$DROPLET_NAME" \
    --region "$REGION" --size "$SIZE" --image "$IMAGE" \
    --ssh-keys "$fingerprint" --tag-names "$TAG" \
    --user-data-file "$here/cloud-init.yaml" \
    --enable-monitoring ${extra[@]+"${extra[@]}"} --wait >/dev/null
  echo "Created: $DROPLET_NAME"
fi
ip="$("$DOCTL" compute droplet list --tag-name "$TAG" --format Name,PublicIPv4 --no-header | awk -v n="$DROPLET_NAME" '$1==n {print $2}')"
echo "IP address: $ip"

say "Firewall"
if "$DOCTL" compute firewall list --format Name --no-header | grep -qx "$FIREWALL_NAME"; then
  echo "Already exists: $FIREWALL_NAME"
else
  any="address:0.0.0.0/0,address:::/0"
  "$DOCTL" compute firewall create --name "$FIREWALL_NAME" --tag-names "$TAG" \
    --inbound-rules "protocol:tcp,ports:22,$any protocol:tcp,ports:80,$any protocol:tcp,ports:443,$any" \
    --outbound-rules "protocol:tcp,ports:all,$any protocol:udp,ports:all,$any protocol:icmp,$any" >/dev/null
  echo "Created: $FIREWALL_NAME (SSH, HTTP and HTTPS only)"
fi

say "Waiting for first-boot setup to finish"
ready=false
for _ in $(seq 1 60); do
  if ssh -i "$SSH_KEY_FILE" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@$ip" 'cloud-init status --wait >/dev/null; docker --version' 2>/dev/null; then
    ready=true
    break
  fi
  sleep 5
done
$ready || echo "The droplet isn't answering over SSH yet. That's fine: the deploy finishes the setup."

if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  say "GitHub secrets for $GITHUB_REPO"
  existing="$(gh secret list --repo "$GITHUB_REPO" --json name --jq '.[].name')"
  has() { grep -qx "$1" <<<"$existing"; }
  gh secret set DROPLET_HOST --repo "$GITHUB_REPO" --body "$ip"
  gh secret set DROPLET_SSH_KEY --repo "$GITHUB_REPO" < "$SSH_KEY_FILE"
  # Set once only: changing it later would lock the app out of the existing database.
  has POSTGRES_PASSWORD || gh secret set POSTGRES_PASSWORD --repo "$GITHUB_REPO" --body "$(openssl rand -hex 24)"
  # Left alone if already set, so a domain set later isn't overwritten.
  has APP_URL || gh secret set APP_URL --repo "$GITHUB_REPO" --body "http://$ip"
  has SITE_ADDRESS || gh secret set SITE_ADDRESS --repo "$GITHUB_REPO" --body ":80"
  if ! has ADMIN_EMAILS; then
    admins="${ADMIN_EMAILS:-}"
    [ -z "$admins" ] && read -r -p "Admin emails (comma-separated): " admins
    gh secret set ADMIN_EMAILS --repo "$GITHUB_REPO" --body "$admins"
  fi

  say "Starting the deploy"
  if gh workflow run deploy.yml --repo "$GITHUB_REPO" >/dev/null 2>&1; then
    echo "Deploy started. Watch it with: gh run watch --repo $GITHUB_REPO"
    echo "Then open: http://$ip"
  else
    echo "Couldn't start the Deploy workflow. It runs from main, so merge the PR that adds it, then run:"
    echo "  gh workflow run deploy.yml --repo $GITHUB_REPO"
  fi
else
  say "Next steps"
  echo "gh isn't installed or signed in, so add these repository secrets by hand"
  echo "(GitHub repo, Settings, Secrets and variables, Actions):"
  echo "  DROPLET_HOST       $ip"
  echo "  DROPLET_SSH_KEY    contents of $SSH_KEY_FILE"
  echo "  POSTGRES_PASSWORD  output of: openssl rand -hex 24  (set once, never change)"
  echo "  APP_URL            http://$ip"
  echo "  SITE_ADDRESS       :80"
  echo "  ADMIN_EMAILS       comma-separated admin emails"
  echo "Then run the Deploy workflow from the Actions tab."
fi
