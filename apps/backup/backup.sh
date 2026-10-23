#!/usr/bin/env bash
# Dumps the whole database and its manifest from one snapshot, encrypts both
# with the owner's age public key, and uploads them to S3, or writes them to a
# directory with --local-dir. Plaintext only ever passes through pipes and
# memory; the temporary directory holds encrypted files.
#
# Usage: backup.sh [--local-dir <path>]
# Environment: DATABASE_URL and AGE_RECIPIENT always; BACKUP_BUCKET,
# AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY for S3.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly script_dir
# shellcheck source=common.sh
source "$script_dir/common.sh"
readonly end_marker="__backup_query_end__"
# Railway's cron schedule for the backup service, 0 20 * * *, set in its
# dashboard. A run that starts in another hour was triggered by hand.
readonly scheduled_utc_hour="20"

require_env() {
  local name
  for name in "$@"; do
    [[ -n "${!name:-}" ]] || fail "$name is not set"
  done
}

local_dir=""
while (($# > 0)); do
  case "$1" in
    --local-dir)
      (($# >= 2)) || fail "--local-dir needs a path"
      local_dir="$2"
      shift 2
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

# Read the clock once, at the start, so a slow run keeps the prefix it began
# with.
read -r year month day <<<"$(TZ=Asia/Bangkok date '+%Y %m %d')"
read -r utc_hour utc_stamp <<<"$(date -u '+%H %Y-%m-%dT%H%M%SZ')"

require_env DATABASE_URL AGE_RECIPIENT
if [[ -z "$local_dir" ]]; then
  require_env BACKUP_BUCKET AWS_REGION AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
fi

# Reject a bad recipient before touching the database.
age --encrypt --recipient "$AGE_RECIPIENT" </dev/null >/dev/null ||
  fail "AGE_RECIPIENT is not a valid age recipient"

work_dir="$(mktemp -d)"
psql_pid=""
cleanup() {
  if [[ -n "$psql_pid" ]]; then
    kill "$psql_pid" 2>/dev/null || true
  fi
  rm -rf "$work_dir"
}
trap cleanup EXIT

# One psql session holds the REPEATABLE READ transaction open while pg_dump
# reads its exported snapshot, so the dump and the manifest see the same data.
coproc psql_session {
  exec psql --no-psqlrc --quiet --tuples-only --no-align \
    --set ON_ERROR_STOP=1 --dbname="$DATABASE_URL"
}
# coproc sets psql_session_PID, which shellcheck cannot see.
# shellcheck disable=SC2154
psql_pid="$psql_session_PID"
exec {psql_in}>&"${psql_session[1]}" {psql_out}<&"${psql_session[0]}"

# Sends SQL to the session and prints its output up to the end marker. psql
# exits on any SQL error, so a missing marker means the query failed.
query() {
  local line
  printf '%s\n\\echo %s\n' "$1" "$end_marker" >&"$psql_in"
  while IFS= read -r -t 600 line <&"$psql_out"; do
    if [[ "$line" == "$end_marker" ]]; then
      return 0
    fi
    printf '%s\n' "$line"
  done
  fail "the database session ended early"
}

query "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;" >/dev/null
snapshot="$(query "SELECT pg_export_snapshot();")"
[[ -n "$snapshot" ]] || fail "no snapshot was exported"
log "exported snapshot"

pg_dump --format=custom --snapshot="$snapshot" --dbname="$DATABASE_URL" |
  age --encrypt --recipient "$AGE_RECIPIENT" --output "$work_dir/$dump_name"
log "dumped and encrypted the database"

manifest="$(query "$(cat "$script_dir/manifest.sql")")"
[[ -n "$manifest" ]] || fail "the manifest is empty"
printf '%s\n' "$manifest" |
  age --encrypt --recipient "$AGE_RECIPIENT" --output "$work_dir/$manifest_name"
log "built and encrypted the manifest"

query "COMMIT;" >/dev/null
printf '\\quit\n' >&"$psql_in"
wait "$psql_pid" || fail "psql exited with an error"
psql_pid=""

if [[ -n "$local_dir" ]]; then
  mkdir -p "$local_dir"
  cp "$work_dir/$dump_name" "$work_dir/$manifest_name" "$local_dir/"
  log "wrote $dump_name and $manifest_name to $local_dir"
  exit 0
fi

# The nightly run is dated by Bangkok, where 20:00 UTC is 03:00 the next day.
# A run triggered by hand goes under its own manual/ prefix, because a second
# version of a daily/ key is what a planted backup looks like, and the restore
# drill refuses it.
if [[ "$utc_hour" == "$scheduled_utc_hour" ]]; then
  prefixes=("daily/$year-$month-$day")
  if [[ "$day" == "01" ]]; then
    prefixes+=("monthly/$year-$month")
  fi
else
  prefixes=("manual/$utc_stamp")
fi

for prefix in "${prefixes[@]}"; do
  for name in "$dump_name" "$manifest_name"; do
    # Object Lock refuses uploads without a checksum, so name one explicitly
    # instead of relying on the CLI's default.
    aws s3 cp --only-show-errors --checksum-algorithm CRC64NVME \
      "$work_dir/$name" "s3://$BACKUP_BUCKET/$prefix/$name"
  done
  log "uploaded to $prefix/"
done
