#!/usr/bin/env bash
# Restores a named backup into a new database and proves it matches the
# backup's manifest, for recovering production by hand
# (.scratch/production-recovery/spec.md). It creates the target database and
# refuses one that exists; it never drops, renames or overwrites anything.
# With --check, it compares an existing database with the manifest instead.
# Runs on the owner's machine with Docker, age and, for S3, the AWS CLI.
# psql and pg_restore run from the job's pinned image, and decrypted data only
# passes through pipes and memory.
#
# Usage: restore.sh --identity <age identity file>
#          (--backup <prefix> [--profile <aws profile>] | --local-dir <path>)
#          [--check]
# Environment: TARGET_DATABASE_URL, the target database's URL; without it the
# URL is asked for at a hidden prompt, so it stays out of shell history.
# Without --backup or --local-dir, it prints the newest daily/ prefix as a
# suggestion and exits.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly script_dir
# shellcheck source=restore-common.sh
source "$script_dir/restore-common.sh"

identity=""
backup=""
local_dir=""
check_only=""
while (($# > 0)); do
  case "$1" in
    --identity)
      (($# >= 2)) || fail "--identity needs a path"
      identity="$2"
      shift 2
      ;;
    --backup)
      (($# >= 2)) || fail "--backup needs a prefix"
      backup="${2%/}"
      shift 2
      ;;
    --local-dir)
      (($# >= 2)) || fail "--local-dir needs a path"
      local_dir="$2"
      shift 2
      ;;
    --profile)
      (($# >= 2)) || fail "--profile needs a name"
      aws_profile="$2"
      shift 2
      ;;
    --check)
      check_only="yes"
      shift
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

[[ -z "$backup" || -z "$local_dir" ]] ||
  fail "--backup and --local-dir cannot be used together"

[[ -n "$local_dir" ]] || require_tools aws

# There is no default backup: restoring the wrong one silently is worse than
# asking.
if [[ -z "$backup" && -z "$local_dir" ]]; then
  bucket="$(backup_bucket)"
  newest="$(newest_daily_prefix "$bucket")"
  printf '%s\n' "$newest"
  log "no backup named; the newest is $newest, so rerun with --backup $newest to restore it"
  exit 1
fi

require_identity "$identity"
require_tools docker age

target_url="${TARGET_DATABASE_URL:-}"
if [[ -z "$target_url" ]]; then
  [[ -t 0 ]] || fail "TARGET_DATABASE_URL is not set and there is no terminal to ask for it"
  read -r -s -p "Target database URL: " target_url
  printf '\n' >&2
  [[ -n "$target_url" ]] || fail "no target database URL given"
fi
readonly target_url

# The database is created through the server's postgres database, at the same
# URL with only the name changed. A plain name needs no URL decoding.
url_pattern='^(postgres(ql)?://[^/?]+)/([A-Za-z_][A-Za-z0-9_]*)(\?.*)?$'
[[ "$target_url" =~ $url_pattern ]] ||
  fail "the target URL must be postgresql://…/<database name>, with a name of letters, digits and underscores"
readonly target_database="${BASH_REMATCH[3]}"
readonly maintenance_url="${BASH_REMATCH[1]}/postgres${BASH_REMATCH[4]}"
[[ "$target_database" != "postgres" ]] || fail "the target cannot be the postgres database"

image="$(pinned_image)"
readonly image

work_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT
exit_on_signals

# Runs a PostgreSQL client from the pinned image against a database URL. The
# URL reaches the container through its environment, not docker's command
# line. The host network lets it reach a server on localhost as well as a
# public proxy.
pg_client() {
  local url="$1"
  shift
  DATABASE_URL="$url" docker run --rm --interactive --network host \
    --env DATABASE_URL "$image" \
    sh -c 'program="$1"; shift; exec "$program" --dbname="$DATABASE_URL" "$@"' \
    sh "$@"
}

psql_at() {
  local url="$1"
  shift
  pg_client "$url" psql --no-psqlrc --quiet --tuples-only --no-align \
    --set ON_ERROR_STOP=1 "$@"
}

load_backup "$work_dir" "$local_dir" "$backup"

expected="$(decrypt_manifest "$identity" "$work_dir")"
log "decrypted the manifest"

if [[ -z "$check_only" ]]; then
  exists="$(psql_at "$maintenance_url" --set name="$target_database" \
    <<<"SELECT count(*) FROM pg_database WHERE datname = :'name';")" ||
    fail "cannot reach the server's postgres database"
  [[ "$exists" == "0" ]] ||
    fail "the database $target_database already exists; restore into a new one"

  psql_at "$maintenance_url" --set name="$target_database" \
    <<<'CREATE DATABASE :"name";' || fail "cannot create the database $target_database"
  log "created the database $target_database"

  # A failed restore leaves the new database for the owner to inspect and
  # drop; nothing else has changed.
  decrypt_dump "$identity" "$work_dir" |
    pg_client "$target_url" pg_restore --exit-on-error --no-owner \
      --no-privileges ||
    fail "cannot restore the dump into $target_database, which is left as it stands"
  log "restored the dump into $target_database"
fi

actual="$(psql_at "$target_url" <"$script_dir/manifest.sql")" ||
  fail "cannot build the manifest from $target_database"
log "rebuilt the manifest from $target_database"

check_manifest "$expected" "$actual" "$backup_source" psql_at "$target_url"
