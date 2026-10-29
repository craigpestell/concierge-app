#!/bin/sh
# Pull deploys: the droplet deploys main itself, so GitHub never needs to reach the server.
# Installed as /usr/local/sbin/concierge-deploy by deploy/setup-droplet.sh and run every
# 5 minutes by concierge-deploy.timer. Each run finds the newest commit on main whose CI run
# passed (CI publishes ghcr.io/<repo>:<sha> only after the checks pass), and deploys it if it
# isn't already live. A release that fails its health check is rolled back and skipped until
# main moves on.
#
#   concierge-deploy              deploy the newest green commit on main, if it's new
#   concierge-deploy <sha>        deploy that commit (it must have a published image)
#   concierge-deploy --reapply    restart the live release, picking up changes to .env
#   concierge-deploy --rollback   go back to the release before the live one
#   concierge-deploy --status     show what's live and the last run's outcome
#
# Logs: journalctl -u concierge-deploy
set -eu

REPO=craigpestell/concierge-app
IMAGE=ghcr.io/$REPO
APP_DIR=/opt/concierge
STATE=/var/lib/concierge-deploy
LOCK=/run/concierge-deploy.lock

mkdir -p "$STATE"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "Another deploy is running; skipping."
  exit 0
fi

say() { echo "==> $*"; }
status() {
  printf '{"outcome":"%s","sha":"%s","at":"%s"}\n' "$1" "$2" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATE/status.json"
}
# The live commit. Before the first pull deploy, it's the image tag the old push deploy left in .env.
current() {
  if [ -s "$STATE/current" ]; then
    cat "$STATE/current"
  else
    sed -n "s|^APP_IMAGE=$IMAGE:\\([0-9a-f]\\{40\\}\\)$|\\1|p" "$APP_DIR/.env" 2>/dev/null || true
  fi
}
compose() { (cd "$APP_DIR" && docker compose "$@"); }

# Newest commit on main with a successful CI push run. The repository is public, so this
# needs no token (60 requests an hour; the timer uses 12).
latest_green() {
  curl -fsS -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/actions/workflows/ci.yml/runs?branch=main&event=push&status=success&per_page=1" |
    jq -r '.workflow_runs[0].head_sha // empty'
}

# The Compose file, Caddyfile and backup script come from the same commit as the image.
fetch_release_files() {
  sha=$1
  dir="$STATE/releases/$sha"
  mkdir -p "$dir/deploy"
  for f in docker-compose.yml deploy/Caddyfile deploy/backup.sh deploy/pull-deploy.sh; do
    # Commits from before pull deploys have no pull-deploy.sh; that's fine for a rollback.
    curl -fsS -o "$dir/$f" "https://raw.githubusercontent.com/$REPO/$sha/$f" || [ "$f" = deploy/pull-deploy.sh ]
  done
}

install_release_files() {
  dir="$STATE/releases/$1"
  cp "$dir/docker-compose.yml" "$APP_DIR/docker-compose.yml"
  cp "$dir/deploy/Caddyfile" "$dir/deploy/backup.sh" "$APP_DIR/deploy/"
}

set_image() {
  sed -i '/^APP_IMAGE=/d' "$APP_DIR/.env"
  echo "APP_IMAGE=$IMAGE:$1" >> "$APP_DIR/.env"
}

wait_healthy() {
  for _ in $(seq 1 60); do
    id=$(compose ps -q app)
    if [ -n "$id" ] && [ "$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null)" = healthy ]; then
      return 0
    fi
    sleep 5
  done
  return 1
}

start() {
  [ -f "$STATE/releases/$1/docker-compose.yml" ] || fetch_release_files "$1"
  install_release_files "$1"
  set_image "$1"
  compose up -d --no-build --remove-orphans
  wait_healthy
}

login() {
  # Only needed while the GHCR package is private: a token with read:packages.
  if [ -s /etc/concierge-deploy/ghcr-token ]; then
    docker login ghcr.io -u "${GHCR_USER:-craigpestell}" --password-stdin < /etc/concierge-deploy/ghcr-token >/dev/null
  fi
}

deploy() {
  sha=$1
  prev=$(current)
  say "Deploying $sha (live: ${prev:-none})"
  status deploying "$sha"
  fetch_release_files "$sha"
  login
  docker pull -q "$IMAGE:$sha"

  # Migrations run when the app starts, so take a dump first.
  if [ -n "$(compose ps -q db 2>/dev/null)" ]; then
    compose exec -T db pg_dump -U concierge --no-owner concierge | gzip > "$APP_DIR/backups/pre-deploy-$sha.sql.gz"
  fi

  if start "$sha"; then
    [ -n "$prev" ] && [ "$prev" != "$sha" ] && echo "$prev" > "$STATE/previous"
    echo "$sha" > "$STATE/current"
    rm -f "$STATE/failed"
    # Next run uses this commit's version of the script.
    install -m 0755 "$STATE/releases/$sha/deploy/pull-deploy.sh" /usr/local/sbin/concierge-deploy
    status deployed "$sha"
    docker image prune -f >/dev/null
    say "Live: $sha"
    return 0
  fi

  say "$sha failed its health check"
  compose logs --tail 50 app || true
  echo "$sha" > "$STATE/failed"
  if [ -n "$prev" ]; then
    say "Rolling back to $prev"
    start "$prev" || say "Rollback to $prev is not healthy either; check the logs."
  fi
  status failed "$sha"
  return 1
}

deploy_latest() {
  sha=$(latest_green)
  [ -n "$sha" ] || { echo "No green CI run on main yet."; exit 0; }
  if [ "$sha" = "$(current)" ]; then exit 0; fi
  if [ "$sha" = "$(cat "$STATE/failed" 2>/dev/null || true)" ]; then
    echo "$sha failed or was rolled back; waiting for a new commit on main."
    exit 0
  fi
  deploy "$sha"
}

case "${1:-}" in
  --status)
    echo "Live:     $(current)"
    echo "Previous: $(cat "$STATE/previous" 2>/dev/null || true)"
    echo "Skipped:  $(cat "$STATE/failed" 2>/dev/null || true)"
    cat "$STATE/status.json" 2>/dev/null || true
    ;;
  --reapply)
    sha=$(current)
    if [ -z "$sha" ]; then
      deploy_latest
      exit
    fi
    say "Restarting $sha with the current .env"
    set_image "$sha"
    compose up -d --no-build --remove-orphans
    if wait_healthy; then say "Healthy"; else say "Not healthy after restart"; exit 1; fi
    ;;
  --rollback)
    prev=$(cat "$STATE/previous" 2>/dev/null || true)
    [ -n "$prev" ] || { echo "No previous release to roll back to."; exit 1; }
    live=$(current)
    say "Rolling back from $live to $prev"
    start "$prev"
    echo "$prev" > "$STATE/current"
    echo "$live" > "$STATE/previous"
    # Don't redeploy the bad release on the next timer run.
    echo "$live" > "$STATE/failed"
    status rolled-back "$prev"
    ;;
  "")
    deploy_latest
    ;;
  -*)
    echo "Unknown option: $1" >&2
    exit 2
    ;;
  *)
    deploy "$1"
    ;;
esac
