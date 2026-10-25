#!/usr/bin/env bash
# Restores a backup into a throwaway PostgreSQL container and proves it
# matches its manifest: every table's row count and checksum. Runs on the
# owner's machine with Docker, age and, for S3, the AWS CLI. Decrypted data
# only passes through pipes, memory and the container, which is removed with
# its volume whether the drill passes or fails.
#
# Usage: restore-drill.sh --identity <age identity file>
#          [--local-dir <path> | --profile <aws profile>]
# Without --local-dir, it restores the newest daily/ backup from S3 through the
# profile, bookkeeping-backups by default, after `aws sso login`.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly script_dir
# shellcheck source=restore-common.sh
source "$script_dir/restore-common.sh"
readonly database="bookkeeping"
readonly container="bookkeeping-restore-drill-$$"
# How every client inside the throwaway container reaches its server.
readonly container_connection=(--host=127.0.0.1 --username=postgres)

identity=""
local_dir=""
while (($# > 0)); do
  case "$1" in
    --identity)
      (($# >= 2)) || fail "--identity needs a path"
      identity="$2"
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
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

require_identity "$identity"
require_tools docker age
[[ -n "$local_dir" ]] || require_tools aws

image="$(pinned_image)"
readonly image

work_dir="$(mktemp -d)"
container_started=""
cleanup() {
  if [[ -n "$container_started" ]]; then
    docker rm --force --volumes "$container" >/dev/null 2>&1 || true
  fi
  rm -rf "$work_dir"
}
trap cleanup EXIT
exit_on_signals

prefix=""
if [[ -z "$local_dir" ]]; then
  bucket="$(backup_bucket)"
  prefix="$(newest_daily_prefix "$bucket")"
fi
load_backup "$work_dir" "$local_dir" "$prefix"

expected="$(decrypt_manifest "$identity" "$work_dir")"
log "decrypted the manifest"

# No published port and no network: only docker exec reaches the database.
container_started="yes"
docker run --detach --name "$container" --network none \
  --env POSTGRES_DB="$database" --env POSTGRES_HOST_AUTH_METHOD=trust \
  "$image" >/dev/null || fail "cannot start a $image container"

# The image's init server listens only on its socket, so the TCP check passes
# once the final server is up.
ready=""
for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready --quiet \
    "${container_connection[@]}"; then
    ready="yes"
    break
  fi
  sleep 1
done
[[ -n "$ready" ]] || fail "the throwaway database did not start"

# check_manifest passes it arguments.
# shellcheck disable=SC2120
psql_drill() {
  docker exec --interactive "$container" psql --no-psqlrc --quiet \
    --tuples-only --no-align --set ON_ERROR_STOP=1 \
    "${container_connection[@]}" --dbname="$database" "$@"
}

decrypt_dump "$identity" "$work_dir" |
  docker exec --interactive "$container" pg_restore --exit-on-error \
    --no-owner --no-privileges "${container_connection[@]}" \
    --dbname="$database" ||
  fail "cannot restore the dump"
log "restored the dump"

actual="$(psql_drill <"$script_dir/manifest.sql")" ||
  fail "cannot build the manifest from the restored database"
log "rebuilt the manifest from the restored database"

check_manifest "$expected" "$actual" "$backup_source" psql_drill
