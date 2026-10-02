#!/bin/sh
# Dumps the database once a day into /backups and deletes dumps older than KEEP_DAYS.
# The first dump runs an hour after start, once the app has applied its migrations.
set -eu
sleep 3600
while true; do
  file="/backups/concierge-$(date -u +%Y%m%d-%H%M%S).sql.gz"
  if pg_dump --no-owner | gzip > "$file.tmp"; then
    mv "$file.tmp" "$file"
    echo "Backup written: $file"
  else
    rm -f "$file.tmp"
    echo "Backup failed" >&2
  fi
  find /backups -name 'concierge-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
  sleep 86400
done
