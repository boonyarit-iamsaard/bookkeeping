# shellcheck shell=bash
# Sourced by backup.sh and restore-drill.sh: the backup's file names, which the
# job writes and the drill reads, and their shared logging.

# The scripts that source this file use both names.
# shellcheck disable=SC2034
readonly dump_name="bookkeeping.dump.age"
# shellcheck disable=SC2034
readonly manifest_name="manifest.json.age"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

fail() {
  log "error: $*"
  exit 1
}
