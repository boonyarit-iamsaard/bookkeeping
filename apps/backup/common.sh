# Sourced by backup.sh and restore-drill.sh: the backup's file names, which the
# job writes and the drill reads, and their shared logging.

readonly dump_name="bookkeeping.dump.age"
readonly manifest_name="manifest.json.age"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

fail() {
  log "error: $*"
  exit 1
}
