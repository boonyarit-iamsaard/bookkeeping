# shellcheck shell=bash
# Sourced by restore-drill.sh and restore.sh: the owner-side steps both
# restores share, on top of common.sh. Checking the tools, fetching a backup
# and checking its versions and date, decrypting it, and comparing its
# manifest with a database. The job image doesn't ship this file.

# shellcheck source=common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

readonly backup_stack_name="bookkeeping-backups"
readonly backup_region="ap-southeast-1"
# The owner's AWS profile; the restores' --profile replaces it.
aws_profile="bookkeeping-backups"

require_tools() {
  local tool
  for tool in "$@"; do
    command -v "$tool" >/dev/null || fail "$tool is not installed"
  done
}

require_identity() {
  local identity="$1"
  [[ -n "$identity" ]] || fail "--identity is required"
  [[ -r "$identity" ]] || fail "cannot read the identity file $identity"
}

# A docker child can swallow Ctrl-C, so the restores stop explicitly.
exit_on_signals() {
  trap 'exit 130' INT
  trap 'exit 143' TERM
}

# Prints the job image's pinned postgres reference from the Dockerfile beside
# this file, so the restores use the version that dumped and Dependabot moves
# them all together.
pinned_image() {
  local dockerfile image
  dockerfile="$(dirname "${BASH_SOURCE[0]}")/Dockerfile"
  image="$(sed -n 's/^FROM \(postgres:[^ ]*@sha256:[0-9a-f]*\).*/\1/p' "$dockerfile")"
  [[ -n "$image" ]] || fail "no pinned postgres image in $dockerfile"
  printf '%s\n' "$image"
}

aws_cli() {
  aws --profile "$aws_profile" --region "$backup_region" "$@"
}

backup_bucket() {
  aws_cli cloudformation describe-stacks --stack-name "$backup_stack_name" \
    --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
    --output text || fail "cannot read the bucket name; run aws sso login first"
}

# Prints the newest daily/ prefix with any file, so a night missing one file
# fails when it is fetched instead of falling back to an older backup.
newest_daily_prefix() {
  local bucket="$1" prefix
  prefix="$(aws_cli s3api list-objects-v2 --bucket "$bucket" --prefix daily/ \
    --query "(Contents || \`[]\`)[].Key" --output text | tr '\t' '\n' |
    sed -n 's|^\(daily/[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\)/.*|\1|p' |
    sort | tail -n 1)" || fail "cannot list the daily/ backups"
  [[ -n "$prefix" ]] || fail "no daily/ backup found"
  printf '%s\n' "$prefix"
}

# Downloads one backup's two files into a directory, by version ID. The
# uploader key can add a newer version of any key, encrypted to the public
# recipient, so a backup with more than one version, or a date after today,
# is refused rather than trusted.
fetch_backup() {
  local bucket="$1" prefix="$2" dir="$3" stamp backup_date today listing name count version_id

  if [[ ! "$prefix" =~ ^(daily/[0-9]{4}-[0-9]{2}-[0-9]{2}|monthly/[0-9]{4}-[0-9]{2}|manual/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{6}Z)$ ]]; then
    fail "$prefix is not a daily/, monthly/ or manual/ backup prefix"
  fi

  # A manual/ prefix is dated in UTC, which is never ahead of Bangkok, and a
  # monthly/ one by its month.
  stamp="${prefix#*/}"
  backup_date="${stamp:0:10}"
  today="$(TZ=Asia/Bangkok date +%Y-%m-%d)"
  if [[ "$backup_date" > "${today:0:${#backup_date}}" ]]; then
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
      --version-id "$version_id" "$dir/$name" >/dev/null ||
      fail "cannot download $prefix/$name"
  done

  log "downloaded $prefix/"
}

# Copies a directory written by `backup.sh --local-dir` into another.
copy_local_backup() {
  local source_dir="$1" dir="$2" name
  for name in "$dump_name" "$manifest_name"; do
    [[ -r "$source_dir/$name" ]] || fail "cannot read $source_dir/$name"
    cp "$source_dir/$name" "$dir/"
  done
}

# Puts a backup's two files into a directory, from a local directory when one
# is given or else from an S3 prefix, and sets backup_source to where they
# came from. It runs in the caller's shell, so set -e still stops it.
load_backup() {
  local dir="$1" local_dir="$2" prefix="$3" bucket
  if [[ -n "$local_dir" ]]; then
    copy_local_backup "$local_dir" "$dir"
    backup_source="$local_dir"
  else
    bucket="$(backup_bucket)"
    fetch_backup "$bucket" "$prefix" "$dir"
    backup_source="$prefix/"
  fi
}

# Prints a backup's decrypted manifest, which stays in memory.
decrypt_manifest() {
  local identity="$1" dir="$2" manifest
  manifest="$(age --decrypt --identity "$identity" "$dir/$manifest_name")" ||
    fail "cannot decrypt the manifest with $identity"
  [[ -n "$manifest" ]] || fail "the manifest is empty"
  printf '%s\n' "$manifest"
}

# Streams a backup's decrypted dump to stdout, never to disk.
decrypt_dump() {
  local identity="$1" dir="$2"
  age --decrypt --identity "$identity" "$dir/$dump_name"
}

# Prints a psql \set line holding a value on one line, quoted, so values
# reach psql on its standard input instead of a command line `ps` can read.
psql_set() {
  local name="$1" value="$2"
  value="${value//$'\n'/ }"
  value="${value//\\/\\\\}"
  value="${value//\'/\\\'}"
  printf "\\\\set %s '%s'\n" "$name" "$value"
}

# Compares a backup's manifest with one rebuilt from a database, through the
# psql command given after the first three arguments, and fails naming each
# table that differs or exists on one side only.
check_manifest() {
  local expected="$1" actual="$2" backup_source="$3" differences summary line
  shift 3

  differences="$({
    psql_set expected "$expected"
    psql_set actual "$actual"
    cat <<'SQL'
SELECT format(
  '%s: expected %s, found %s',
  coalesce(e.key, a.key),
  coalesce(e.value::text, 'no table'),
  coalesce(a.value::text, 'no table')
)
FROM jsonb_each(:'expected'::jsonb -> 'tables') AS e
FULL JOIN jsonb_each(:'actual'::jsonb -> 'tables') AS a ON a.key = e.key
WHERE e.value IS DISTINCT FROM a.value
ORDER BY coalesce(e.key, a.key);
SQL
  } | "$@")" || fail "cannot compare the manifests"

  if [[ -n "$differences" ]]; then
    while IFS= read -r line; do
      log "mismatch: $line"
    done <<<"$differences"
    fail "the database does not match the manifest of $backup_source"
  fi

  summary="$({
    psql_set expected "$expected"
    cat <<'SQL'
SELECT format(
  '%s tables match, dumped at %s',
  (SELECT count(*) FROM jsonb_object_keys(:'expected'::jsonb -> 'tables')),
  :'expected'::jsonb ->> 'dumpedAt'
);
SQL
  } | "$@")" || fail "cannot summarise the manifest"
  log "passed: $summary, from $backup_source"
}
