# Backup scripts: stay in bash or rewrite

Researched 2026-10-24. Scope: whether `apps/backup` (`backup.sh`,
`common.sh`, `restore-common.sh`, `restore.sh`, `restore-drill.sh`, about 625
lines of bash plus `manifest.sql`) should be rewritten in TypeScript, Python
or Go for maintainability, and if so how to stage it without losing what the
restore drill and the recovery rehearsal proved. Inputs read from the repo:
the scripts, `apps/backup/README.md` and `Dockerfile`, ADR 0013, the backups
and recovery specs, `docs/code-conventions.md` ("Scripts and environment") and
`pnpm-workspace.yaml`.

## Findings from primary sources

### The job image is Alpine 3.24, and Python is already in it

The `postgres` official-images manifest maps `18-alpine` to
`18/alpine3.24` (PostgreSQL 18.6).
<https://github.com/docker-library/official-images/blob/master/library/postgres>
The digest pinned in `apps/backup/Dockerfile`, inspected locally from the
cached image, reports `PG_VERSION=18.6` and `/etc/alpine-release` 3.24.2.

Alpine v3.24 package versions and installed sizes (x86_64):

| Package               | Version    | Installed size | Source                                                                       |
| --------------------- | ---------- | -------------- | ---------------------------------------------------------------------------- |
| `nodejs` (LTS)        | 24.22.1-r0 | 49.9 MiB       | <https://pkgs.alpinelinux.org/package/v3.24/main/x86_64/nodejs>              |
| `nodejs-current`      | 26.5.1-r0  | 74.7 MiB       | <https://pkgs.alpinelinux.org/package/v3.24/community/x86_64/nodejs-current> |
| `aws-cli`             | 2.34.63-r0 | 126.3 MiB      | <https://pkgs.alpinelinux.org/package/v3.24/community/x86_64/aws-cli>        |
| `python3`             | 3.14.8-r0  | 22.5 MiB       | <https://pkgs.alpinelinux.org/package/v3.24/main/x86_64/python3>             |
| `age`                 | 1.3.2-r1   | 13.0 MiB       | <https://pkgs.alpinelinux.org/package/v3.24/community/x86_64/age>            |
| `bash`                | 5.3.9-r1   | 1.3 MiB        | <https://pkgs.alpinelinux.org/package/v3.24/main/x86_64/bash>                |
| `postgresql18-client` | (present)  | 3.3 MiB        | <https://pkgs.alpinelinux.org/package/v3.24/main/x86_64/postgresql18-client> |

Alpine's `aws-cli` depends on `python3` and `py3-awscrt`, so today's image
already carries a Python runtime. `py3-boto3` 1.43.6, `py3-psycopg` 3.3.4 and
`py3-awscrt` 0.34.1 are packaged in v3.24 community; `pyrage` is not.
<https://pkgs.alpinelinux.org/package/v3.24/community/x86_64/py3-boto3>,
<https://pkgs.alpinelinux.org/package/v3.24/community/x86_64/py3-psycopg>

### The snapshot needs one open session, in any language

`pg_export_snapshot()`'s snapshot "is available for import only until the end
of the transaction that exported it."
<https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION>
`SET TRANSACTION SNAPSHOT`, which `pg_dump --snapshot` issues, needs the
importing transaction at `REPEATABLE READ` or `SERIALIZABLE`; if the importer
is `SERIALIZABLE`, the exporter must be too.
<https://www.postgresql.org/docs/18/sql-set-transaction.html>
`pg_dump --snapshot` uses "the specified synchronized snapshot when making a
dump". <https://www.postgresql.org/docs/18/app-pgdump.html>

node-postgres: "You **must** use the _same_ client instance for all statements
within a transaction", and transactions must not go through `pool.query`.
<https://node-postgres.com/features/transactions> So a `pg.Client` holding
`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` while a child `pg_dump`
runs replaces the bash `coproc` and its end marker. Nothing else is needed.
psycopg 3 exposes `isolation_level` and `read_only` on the connection, which
does the same.
<https://www.psycopg.org/psycopg3/docs/basic/transactions.html>

### Child processes and streams in Node

`stream.pipeline` is "a module method to pipe between streams and generators
forwarding errors and properly cleaning up", with a promise form in
`node:stream/promises`.
<https://nodejs.org/api/stream.html#streampipelinesource-transforms-destination-options>
Piping `pg_dump`'s stdout into `age`'s stdin is therefore one awaited call.
Exit codes still have to be checked per child. No library (such as
`pg-copy-streams`) is needed, because `pg_dump` and `pg_restore` stay
programs.

### AWS SDK for JavaScript v3

- `@aws-sdk/lib-storage` "enables uploading large files or streams of unknown
  size" through multipart upload; parts are at least 5 MB.
  <https://github.com/aws/aws-sdk-js-v3/blob/main/lib/lib-storage/README.md>
  The backups are tens of KB (ADR 0013), so a plain `PutObject` with the
  encrypted file as the body is enough and `lib-storage` is not needed.
- `ChecksumAlgorithm.CRC64NVME` is in the flexible-checksums middleware of
  `@aws-sdk/checksums` 3.1001.5. Its `Crc64Nvme` uses the CRT implementation
  when `@aws-sdk/crc64-nvme-crt` has been loaded and otherwise falls back to
  a pure-JS `Crc64NvmeJs`. That was read from the published package's
  `dist-cjs/submodules/crc/index.js`, not from a doc page.
  <https://www.npmjs.com/package/@aws-sdk/checksums>
  The CRT package is optional; which SDK version first shipped the JS
  fallback was not checked.
- `fromSSO({ profile })` and `fromNodeProviderChain()` read the token
  `aws sso login` caches.
  <https://github.com/aws/aws-sdk-js-v3/blob/main/packages/credential-providers/README.md#fromsso>
  The SDK reference guide lists the `sso-session` token-provider
  configuration as supported by JavaScript v3, boto3 and Go v2.
  <https://docs.aws.amazon.com/sdkref/latest/guide/feature-sso-credentials.html>
- `ListObjectVersions` and `GetObject` with `VersionId` are ordinary S3
  operations in every SDK; not separately re-checked here.

### age in TypeScript, Python and Go

- `age-encryption` (typage) is at 0.3.1, published 2026-08-28; 0.3.0 was
  2025-12-29. <https://registry.npmjs.org/age-encryption> Its README covers
  X25519 identity/recipient pairs, passphrase (scrypt) encryption, and
  encrypting and decrypting `ReadableStream`s, on Node.js 20+. It says
  nothing about decrypting a passphrase-protected identity file, and gives no
  stability statement. <https://github.com/FiloSottile/typage>
- The `age` CLI decrypts a passphrase-encrypted identity file passed to `-i`
  automatically; that is how the owner's key is used today.
  <https://github.com/FiloSottile/age#passphrase-protected-key-files>
- Go `filippo.io/age` streams (`Encrypt(dst io.Writer, …) (io.WriteCloser,
error)`, `Decrypt(src io.Reader, …) (io.Reader, error)`).
  <https://github.com/FiloSottile/age/blob/main/age.go> Its package docs
  describe no helper for passphrase-protected identity files; decrypting the
  file with a `ScryptIdentity` and then calling `ParseIdentities` would be the
  route, but that is an inference. <https://pkg.go.dev/filippo.io/age>
- `pyrage`'s README shows bytes-in, bytes-out X25519 and passphrase
  encryption only. It documents no streaming API and no passphrase-protected
  identity files. <https://github.com/woodruffw/pyrage>

In every language, the private side is simplest with the `age` CLI kept as a
subprocess, because it already prompts for the identity passphrase.

### Python and Go S3 checksums

botocore raises `MissingDependencyException` when CRC64NVME is requested
without the CRT installed, so boto3 needs `awscrt`.
<https://github.com/boto/botocore/blob/develop/botocore/httpchecksum.py>
aws-sdk-go-v2 defines `ChecksumAlgorithmCrc64nvme`.
<https://github.com/aws/aws-sdk-go-v2/blob/main/service/s3/types/enums.go>
Its `feature/s3/manager` uploader is marked deprecated in favour of
`feature/s3/transfermanager`.
<https://github.com/aws/aws-sdk-go-v2/blob/main/feature/s3/manager/upload.go>

### Bash tooling, for a fair comparison

- bash-language-server offers diagnostics from ShellCheck when it is
  installed, `shfmt` formatting, jump to declaration, hover docs and
  completion. <https://github.com/bash-lsp/bash-language-server>
- bats-core is "a TAP-compliant testing framework for Bash".
  <https://github.com/bats-core/bats-core>
- The `$(...)` bug class has a bash answer: `shopt -s inherit_errexit` makes
  command substitution inherit `errexit`.
  <https://www.gnu.org/software/bash/manual/html_node/The-Shopt-Builtin.html>
  The page could not be fetched in this session; this is from the manual as
  previously known.
- ShellCheck already runs in `pnpm run ci` as `lint:sh`. The issue 01
  comments record the restore checks as manual runs with a stubbed `aws`; no
  automated test of the scripts exists.

### Dependency surface (npm)

Measured by `npm install --package-lock-only --ignore-scripts` in an empty
directory on 2026-10-24, counting `packages` entries in the lockfile:

| Packages requested                                     | Packages in lockfile |
| ------------------------------------------------------ | -------------------- |
| `@aws-sdk/client-s3` 3.1156.0 + `@aws-sdk/lib-storage` | 37                   |
| `pg` 8.23.1                                            | 14                   |
| `age-encryption` 0.3.1 (`@noble/*`, `@scure/base`)     | 8                    |
| all of the above + `@aws-sdk/client-cloudformation`    | 60                   |

These would sit under the repo's existing `minimumReleaseAge: 4320`,
`trustPolicy: no-downgrade` and `strictDepBuilds` (`pnpm-workspace.yaml`).
Using the `aws` CLI on the owner's side instead of the SDK keeps this to the
`pg` 14, or zero if `psql` stays a subprocess.

## Comparison

| Criterion      | bash (today)                                                         | TypeScript                                                             | Python                                                 | Go                                                     |
| -------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Fit with repo  | Outlier, but ShellCheck in CI                                        | Same toolchain: pnpm, tsx, vitest, Biome, `types:check`                | Second language (only the inline alert Lambda uses it) | New toolchain, no precedent                            |
| Readability    | `coproc`, `exec {fd}`, JMESPath + `awk`, `psql_set` quoting are hard | Typed results, `JSON.parse` instead of `awk`, `try`/`finally`          | Readable; untyped without extra tooling                | Readable, verbose error handling                       |
| Testability    | bats possible, none today                                            | vitest units for prefix/date/version/URL/manifest diff, plus CLI tests | pytest, but a new runner in CI                         | `go test`, new runner in CI                            |
| Job image      | aws-cli 126.3 + python3 22.5 + age 13 + bash 1.3 MiB                 | + nodejs 49.9 MiB and `node_modules`; can drop aws-cli and bash        | Python already present; + boto3, psycopg               | One binary (size not measured); can drop aws-cli, bash |
| Supply chain   | Alpine packages only                                                 | 14–60 npm packages under pnpm's release-age and trust rules            | Alpine `py3-*` or PyPI without pnpm's rules            | Go modules, separate pinning                           |
| Migration risk | None; proven by drill and rehearsal                                  | Moderate; restore side runs on a dev machine that has Node             | Moderate                                               | Highest: new language and build                        |

## Assessment

**Verdict: worth it, but not as one rewrite, and in TypeScript.** The pain is
concentrated in the owner-side restore tooling (`restore-common.sh`,
`restore.sh`, `restore-drill.sh`, about 470 lines). It runs rarely, under
stress, and is tested only by hand. `backup.sh` is 139 lines, runs unattended
every night, and changes seldom; rewriting it buys readability at the cost of
re-proving the one path that produces every backup. Port the restore side
first, prove it, and port the job only if a real change to it comes.

TypeScript wins on fit: the repo's tests, type checks, lint and supply-chain
rules apply unchanged, and the owner reads it. Python's head start (already in
the image) does not outweigh a second test runner and dependency policy. Go's
single binary is the best runtime artefact but the worst fit. Hardening the
bash instead (`inherit_errexit`, bats) fixes the bug class but not the
readability problem the owner raised.

What stays a subprocess, in every stage:

- `pg_dump`, `pg_restore` and `psql`, from the pinned image through Docker on
  the owner's side, as now. The pinned image is what guarantees the restoring
  version matches the dumping one.
- `age`, on both sides. It already prompts for the identity passphrase, and
  typage is pre-1.0 and documents no passphrase-protected identities.
- The `aws` CLI on the owner's side, called with `--output json`, at least in
  stage 2; it is needed for `aws sso login` anyway.

What moves into code: argument parsing, the prefix and Bangkok-date checks,
the version and delete-marker check over parsed JSON, the URL parsing, the
manifest comparison (two `JSON.parse` results diffed in TypeScript instead of
`psql_set` quoting and a SQL `FULL JOIN`), and cleanup through `try`/`finally`
and signal handlers. `manifest.sql` stays SQL and stays shared.

Staged plan, each stage proven before the next:

1. **Characterisation tests against the bash.** A vitest suite runs the
   current scripts as black boxes with a stubbed `aws` on `PATH` and
   `--local-dir` fixtures. It covers the cases issue 01 lists: version counts,
   delete markers, future dates, bad prefixes, bad URLs, an existing target,
   a manifest mismatch naming the table, exit 130/143. Proof: the suite passes
   on today's scripts. It needs a PostgreSQL container, so it runs as an
   integration suite, not alongside e2e or Sonar.
2. **Port the restore side to TypeScript.** `apps/backup` becomes a workspace
   package run with tsx; the job image stays as it is. Pure logic gets unit
   tests. Proof: the stage 1 suite passes against the new entry points
   unchanged; then the owner runs the drill against the newest `daily/`
   backup and a `restore.sh --check` against a restored database, and both
   pass. Delete the bash restore scripts in the same change.
3. **Rehearse.** Repeat the recovery rehearsal in a temporary Railway project
   with the TypeScript restore. Proof: the runbook's checks pass and the
   timing is recorded.
4. **Port the job only on demand.** If `backup.sh` must change, port it:
   `pg.Client` holds the transaction, `pg_dump` and `age` are spawned and
   joined with `pipeline`, and `PutObject` uploads with
   `ChecksumAlgorithm: "CRC64NVME"`. Install `nodejs` and drop `aws-cli` and
   `bash` from the image. Proof: run old and new with `--local-dir` against
   the same database. The decrypted manifests must match apart from
   `dumpedAt`, and `pg_restore --list` output must match apart from its
   header. Then run the new image once by hand, which uploads under
   `manual/`, and drill that prefix with `restore.sh --backup`. Switch the
   cron only after that, and watch the missing-night alarm for a week.

## Could not be verified

- The bash manual page for `inherit_errexit` did not load in this session.
- Which `@aws-sdk/*` version first shipped the pure-JS CRC64NVME fallback.
- Go binary size and Python image size for this job; neither was built.
- Whether typage can decrypt a passphrase-protected identity file by
  decrypting it as a passphrase file and then adding the identity. This is
  inferred from the format, not documented.
