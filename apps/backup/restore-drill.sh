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
readonly dump_name="bookkeeping.dump.age"
readonly manifest_name="manifest.json.age"
readonly stack_name="bookkeeping-backups"
readonly region="ap-southeast-1"
readonly database="bookkeeping"
readonly container="bookkeeping-restore-drill-$$"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

fail() {
  log "error: $*"
  exit 1
}

identity=""
local_dir=""
profile="bookkeeping-backups"
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
      profile="$2"
      shift 2
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

[[ -n "$identity" ]] || fail "--identity is required"
[[ -r "$identity" ]] || fail "cannot read the identity file $identity"
for tool in docker age; do
  command -v "$tool" >/dev/null || fail "$tool is not installed"
done
if [[ -z "$local_dir" ]]; then
  command -v aws >/dev/null || fail "aws is not installed"
fi

# Restore with the image the backup job dumps with, so Dependabot moves both.
image="$(sed -n 's/^FROM \(postgres:[^ ]*@sha256:[0-9a-f]*\).*/\1/p' "$script_dir/Dockerfile")"
[[ -n "$image" ]] || fail "no pinned postgres image in $script_dir/Dockerfile"
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
# A docker child can swallow Ctrl-C, so stop the drill explicitly.
trap 'exit 130' INT
trap 'exit 143' TERM

aws_cli() {
  aws --profile "$profile" --region "$region" "$@"
}

# Downloads the newest daily/ backup's two files into the work directory, by
# version ID. The uploader key can add a newer version of any key, encrypted
# to the public recipient, so a backup with more than one version, or a date
# after today, is refused rather than trusted.
fetch_newest_backup() {
  local bucket prefix today listing name count version_id

  bucket="$(aws_cli cloudformation describe-stacks --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
    --output text)" || fail "cannot read the bucket name; run aws sso login first"

  # The newest date with any file, so a night missing one file fails below
  # instead of falling back to an older backup.
  prefix="$(aws_cli s3api list-objects-v2 --bucket "$bucket" --prefix daily/ \
    --query "(Contents || \`[]\`)[].Key" --output text | tr '\t' '\n' |
    sed -n 's|^\(daily/[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\)/.*|\1|p' |
    sort | tail -n 1)" || fail "cannot list the daily/ backups"
  [[ -n "$prefix" ]] || fail "no daily/ backup found"

  today="$(TZ=Asia/Bangkok date +%Y-%m-%d)"
  if [[ "${prefix#daily/}" > "$today" ]]; then
    fail "$prefix is dated after today in Bangkok ($today); refusing it"
  fi

  # Delete markers count as versions: any of them means the key was touched.
  listing="$(aws_cli s3api list-object-versions --bucket "$bucket" \
    --prefix "$prefix/" --output text \
    --query "[(Versions || \`[]\`)[].[Key, VersionId], (DeleteMarkers || \`[]\`)[].[Key, VersionId]][]")" ||
    fail "cannot list the versions under $prefix/"

  for name in "$dump_name" "$manifest_name"; do
    read -r count version_id < <(awk -F '\t' -v key="$prefix/$name" \
      '$1 == key { count++; version = $2 } END { print count + 0, version }' <<<"$listing")
    ((count > 0)) || fail "$prefix/$name is missing"
    ((count == 1)) ||
      fail "$prefix/$name has $count versions; one may be planted, so it is not restored"
    aws_cli s3api get-object --bucket "$bucket" --key "$prefix/$name" \
      --version-id "$version_id" "$work_dir/$name" >/dev/null ||
      fail "cannot download $prefix/$name"
  done

  backup_source="$prefix/"
  log "downloaded $prefix/"
}

backup_source=""
if [[ -n "$local_dir" ]]; then
  for name in "$dump_name" "$manifest_name"; do
    [[ -r "$local_dir/$name" ]] || fail "cannot read $local_dir/$name"
    cp "$local_dir/$name" "$work_dir/"
  done
  backup_source="$local_dir"
else
  fetch_newest_backup
fi

expected="$(age --decrypt --identity "$identity" "$work_dir/$manifest_name")" ||
  fail "cannot decrypt the manifest with $identity"
[[ -n "$expected" ]] || fail "the manifest is empty"
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
  if docker exec "$container" pg_isready --quiet --host=127.0.0.1 --username=postgres; then
    ready="yes"
    break
  fi
  sleep 1
done
[[ -n "$ready" ]] || fail "the throwaway database did not start"

psql_drill() {
  docker exec --interactive "$container" psql --no-psqlrc --quiet \
    --tuples-only --no-align --set ON_ERROR_STOP=1 \
    --host=127.0.0.1 --username=postgres --dbname="$database" "$@"
}

age --decrypt --identity "$identity" "$work_dir/$dump_name" |
  docker exec --interactive "$container" pg_restore --exit-on-error \
    --no-owner --no-privileges --host=127.0.0.1 --username=postgres \
    --dbname="$database" ||
  fail "cannot restore the dump"
log "restored the dump"

actual="$(psql_drill <"$script_dir/manifest.sql")" ||
  fail "cannot build the manifest from the restored database"
log "rebuilt the manifest from the restored database"

# Compares the two manifests' tables in the container, one line per table
# that differs or exists on one side only.
differences="$(psql_drill --set expected="$expected" --set actual="$actual" <<'SQL'
SELECT format(
  '%s: expected %s, restored %s',
  coalesce(e.key, a.key),
  coalesce(e.value::text, 'no table'),
  coalesce(a.value::text, 'no table')
)
FROM jsonb_each(:'expected'::jsonb -> 'tables') AS e
FULL JOIN jsonb_each(:'actual'::jsonb -> 'tables') AS a ON a.key = e.key
WHERE e.value IS DISTINCT FROM a.value
ORDER BY coalesce(e.key, a.key);
SQL
)" || fail "cannot compare the manifests"

if [[ -n "$differences" ]]; then
  while IFS= read -r line; do
    log "mismatch: $line"
  done <<<"$differences"
  fail "the restored database does not match the manifest of $backup_source"
fi

summary="$(psql_drill --set expected="$expected" <<'SQL'
SELECT format(
  '%s tables match, dumped at %s',
  (SELECT count(*) FROM jsonb_object_keys(:'expected'::jsonb -> 'tables')),
  :'expected'::jsonb ->> 'dumpedAt'
);
SQL
)"
log "passed: $summary, from $backup_source"
