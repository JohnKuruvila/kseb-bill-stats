#!/bin/sh
set -eu

timestamp() {
  date +"%Y-%m-%d %H:%M:%S %Z"
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*"
}

if [ -f /etc/environment ]; then
  # Export container environment for cron-triggered runs.
  set -a
  . /etc/environment
  set +a
fi

if [ -z "${KSEB_CONSUMER_NUMBER:-}" ] || [ -z "${KSEB_REGISTERED_MOBILE:-}" ]; then
  log "Skipping sync because KSEB_CONSUMER_NUMBER or KSEB_REGISTERED_MOBILE is not set."
  exit 0
fi

log "Starting KSEB bill sync."
if python3 scripts/script.py sync --pdf-dir kseb-bills --json dashboard/data/bills.json --csv dashboard/data/bills.csv; then
  log "KSEB bill sync finished successfully."
else
  status=$?
  log "KSEB bill sync failed with exit code ${status}."
  exit "${status}"
fi
