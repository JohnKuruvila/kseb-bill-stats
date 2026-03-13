#!/bin/sh
set -eu

timestamp() {
  date +"%Y-%m-%d %H:%M:%S %Z"
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*"
}

write_environment() {
  : > /etc/environment
  env | while IFS='=' read -r key value; do
    escaped_value=$(printf '%s' "$value" | sed 's/"/\\"/g')
    printf '%s="%s"\n' "$key" "$escaped_value" >> /etc/environment
  done
}

install_cron_schedule() {
  schedule="${KSEB_SYNC_CRON:-0 6 1 * *}"
  cat > /etc/cron.d/kseb-sync <<EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
${schedule} cd /app && /bin/sh /app/docker/run-sync.sh >> /proc/1/fd/1 2>> /proc/1/fd/2
EOF
  chmod 0644 /etc/cron.d/kseb-sync
  crontab /etc/cron.d/kseb-sync
}

mkdir -p /app/kseb-bills /app/dashboard/data /app/exports /var/log/cron

write_environment
install_cron_schedule

log "Configured monthly sync cron: ${KSEB_SYNC_CRON:-0 6 1 * *}"
cron

if [ "${KSEB_RUN_SYNC_ON_STARTUP:-true}" = "true" ]; then
  log "Running startup sync before serving the dashboard."
  /bin/sh /app/docker/run-sync.sh || log "Startup sync failed; continuing to serve existing dashboard data."
else
  log "Skipping startup sync because KSEB_RUN_SYNC_ON_STARTUP=${KSEB_RUN_SYNC_ON_STARTUP:-false}."
fi

log "Serving dashboard at http://0.0.0.0:8000/dashboard/"
exec python3 -m http.server 8000 --bind 0.0.0.0
