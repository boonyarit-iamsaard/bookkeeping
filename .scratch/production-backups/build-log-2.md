# Build log: production backups, part 2

Continues `build-log-1.md`, which reached the repository's file-size budget
after 2026-10-18. The same rules apply: one dated entry per working session,
each answering **What**, **Why**, **How** and **Struggles**, and nothing that
is unsafe to publish.

## 2026-10-18: the nightly job goes live

### What

Ticket 04 shipped as PR #31: `apps/backup/`, a Railway cron service that
dumps the production database every night at 03:00 Bangkok, writes a
manifest from the same snapshot, encrypts both with `age`, and uploads them
to the bucket from ticket 03. The owner configured the `backup` service in
the dashboard and triggered the first run by hand. It took 7 seconds. The
first scheduled run landed at 03:04 Bangkok on 2026-10-19.

### Why

- Until this ran, the re-encrypted dump from 2026-10-17 was the only copy of
  the ledger outside Railway.
- The manifest is what makes ticket 06 possible: a restore can be checked
  against row counts and checksums taken in the same snapshot as the dump,
  without ever connecting to production.

### How

- **One snapshot, two outputs.** A psql session opens a `REPEATABLE READ READ
ONLY` transaction and exports its snapshot. `pg_dump --snapshot` reads
  that snapshot while the same session builds the manifest, so the dump and
  its manifest describe exactly the same data.
- **No plaintext on disk.** The dump goes through a pipe straight into
  `age`, and the manifest stays in memory until it is encrypted.
- **A checksum that means the same thing twice.** Each table's checksum is
  an MD5 of its row text in primary-key order. Row text depends on session
  settings, so the query pins `TimeZone`, `DateStyle`, `IntervalStyle`,
  `extra_float_digits` and `bytea_output`. The query lives in
  `manifest.sql`, so the drill can run the same file against a restore.
- **Failure paths tested on purpose.** A missing variable, a bad recipient,
  a bad password, an unknown host, an unwritable directory and an
  unreachable S3 endpoint each exited 1, and no log showed a secret. With
  `date` stubbed, the first of the month also wrote under `monthly/`.

### Struggles

- **Config as code, deprecated.** Railway's docs say new services cannot opt
  into `railway.json`, and existing files stop being read on 2026-12-01. The
  `backup` service is configured in the dashboard instead, and moving the
  other two services off `railway.json` became a deployment ticket.
- **A field that only knows `main`.** The Dockerfile path field suggests
  only files already on `main`, so the path had to be typed in before the
  branch merged.
- **The checksum question, closed.** The job passes `--checksum-algorithm
CRC64NVME` explicitly instead of trusting the CLI default, and the first
  manual run proved that S3 accepts it on the Object Lock bucket.
- **Every line an error.** Railway labels the job's progress lines `[err]`,
  because the job logs to stderr. Nothing was wrong.

### Numbers

| Item                     | Value                              |
| ------------------------ | ---------------------------------- |
| Image                    | `postgres:18-alpine`, pg_dump 18.6 |
| Service size             | 0.5 vCPU, 500 MB                   |
| First manual run         | 7 s                                |
| First scheduled run      | 6 s, objects at 03:04 Bangkok      |
| Encrypted dump, manifest | 46.5 KB, 1.1 KB                    |
| Failure paths tested     | 6, each exit 1, no secret logged   |

### Where it stands

- Ticket 04 closed on 2026-10-19 after the first scheduled run.
- Agent, ticket 05 next: the alert for a missing backup.

## 2026-10-19: the missing-backup alert, written

### What

The template gained the alert: an SNS topic with the owner's email, an
inline Python Lambda that lists `daily/` and emails when the newest object
is more than 26 hours old, an EventBridge Scheduler schedule at 09:00
Bangkok, and a CloudWatch alarm on the Lambda's `Errors` metric, so a broken
checker emails too. The agent wrote and tested it; nothing was deployed.

### Why

- A nightly job that fails quietly is worse than no job, because it looks
  like protection. The check runs on AWS, so it still fires when Railway is
  down.
- 26 hours leaves room for a late run without waiting two nights to notice.

### How

- **Least privilege again.** The Lambda's role may list only `daily/`,
  publish to the topic and write its own logs. The scheduler's role may
  only invoke the function.
- **Testing the code inside the template.** The handler was extracted from
  the YAML and tested with boto3 stubbed: eight cases, covering a missing
  backup, the threshold boundary, the newest object across pages, the prefix,
  and a listing failure that must raise.

### Struggles

- **`26.5` was a valid number.** The parameter is a CloudFormation `Number`,
  so a fractional threshold passed validation and crashed `int()` in the
  handler. Review caught it; the handler uses `float()`, with a test.
- **An alarm with a blind spot.** If the scheduler can't invoke the function
  at all, there is no `Errors` datapoint, so the alarm stays silent. That is
  recorded as a known limit rather than solved.
- **Encryption the alarm can't use.** Sonar flagged the topic for having no
  KMS encryption. The alarm can't publish with the AWS managed `aws/sns` key,
  and a customer managed key alone would cost the whole monthly budget. The
  messages hold only timestamps and leave as plain email anyway, so the rule
  is turned off for this resource, with the reason above it in the template.

### Where it stands

- Owner, next: deploy the update, confirm the email subscription, and prove
  the alert fires.

## 2026-10-21: the alert, deployed and proven

### What

The owner followed `runbooks/05-alert-deploy-and-proof.md`. The stack update
created only the seven alert resources and left the bucket, its policy, the
uploader and the budget untouched. To prove the alert, the threshold went
down to 1 hour, a manual invoke reported the newest backup as stale, and the
email arrived within the minute. The threshold went back to 26 hours.

### Why

- An alert that has never fired is a guess. Lowering the threshold made a
  healthy backup look stale, which proves the whole path, from Lambda to SNS
  to inbox, without breaking anything.

### How

- **Read the change set first.** As in ticket 03, the update was reviewed as
  a change set before it ran, to confirm that nothing existing would be
  replaced.
- **Restore, then check.** After the threshold went back up, the function's
  environment was read back to confirm `MAX_AGE_HOURS` was `26`.

### Struggles

<!-- Owner: add what was hard during the deploy, if anything. The runbook
was tightened before the run (4b72b1c, merged as 03b5f05); say what changed and why. -->

### Where it stands

- The first scheduled check ran at 09:00 Bangkok on 2026-10-22, logged a
  clean run and sent no email. Ticket 05 closed that day.

## 2026-10-22: an incident, then the restore drill

### What

Railway disclosed on 2026-10-21 that a third party may have read customer
environment variables, during an outage that also paused builds. The
`backup` service holds the uploader key there. The day started by checking
for damage and ended with ticket 06: `apps/backup/restore-drill.sh`, which
restores the newest backup into a throwaway container and compares it with
its manifest. The owner ran it against S3 and it passed: 10 tables match
`daily/2026-10-22/`. The spec is done.

### Why

- A backup that has never been restored is a hope, not a backup. The drill
  is also what makes production migrations safe to start (ADR 0009).
- The incident changed the drill. The uploader key can't read or delete,
  but it can add a newer version of a key, and the `age` recipient is
  public. Anyone holding the leaked key could plant a fake backup with a
  matching manifest, and a naive drill would restore it and pass.

### How

- **Damage check first.** The bucket held one version per key and no delete
  markers. The key's only use since it was created was the nightly upload
  and one check from ticket 03, and GitHub showed nothing unexpected.
- **Refuse what looks planted.** The drill refuses a backup when either file
  has more than one version, delete markers included, or when its date is
  after today in Bangkok, because a planted future date would otherwise be
  newest with a single version. It downloads each file by version ID.
- **Same image, same query.** The drill reads its Postgres image from the
  job's Dockerfile, so Dependabot moves both together, and it recomputes
  the manifest with the job's `manifest.sql`.
- **Leave nothing behind.** The container runs with `--network none` and is
  removed with its volume on any exit, Ctrl-C included. The dump streams
  from `age` into `pg_restore`, so no decrypted file is written.
- **Proving it can fail.** A changed row count, a changed row, two
  versions, a delete marker, a future date and a missing file each exited 1
  and named the reason.

### Struggles

- **Editing a restore the drill never pauses for.** The criterion asked for
  a test with one restored row changed, but the drill restores and compares
  in one go. Instead, a row was updated after a backup and a second backup
  taken; its dump with the first backup's manifest stands in for the edit.
- **Only the owner can run it.** `age` asks for the identity's passphrase on
  the terminal, so the agent verified the drill against local backups and
  the owner ran the real one.
- **zsh is not bash.** In the agent's shell, `$var` does not word-split, so
  `env $c cmd` passed one argument. Test loops now run under `bash`.

<!-- Owner: add anything from the incident or the drill run that the
records above miss, and name the private screenshots. -->

### Numbers

| Item                            | Value                      |
| ------------------------------- | -------------------------- |
| Tables compared                 | 10, all match              |
| Refusals tested with stubbed S3 | 6, each exit 1             |
| Mismatches tested locally       | 2, each named the table    |
| Object versions per key         | 1, no delete markers       |
| Next drill                      | 2027-01-22, then quarterly |

### Where it stands

- The spec is `done` and `production-migrations` is unblocked. Ticket 03
  stays open only for its first-month AWS cost note.
- The incident's own tickets wait for Railway to resume Hobby builds. Until
  then no Railway variable changes, because a new value only reaches a
  service when it redeploys.
- The same pause holds back a Node 24.22.1 security bump. It rides on this
  branch instead of its own pull request.
- Owner, next: push `feat/production-backups` and open its pull request.

## 2026-10-23: hand-triggered runs get their own prefix

### What

Ticket 07: a backup run started outside the 20:00 UTC hour now uploads to
`manual/<UTC start>/` instead of that night's `daily/` keys. The uploader may
write there, and a lifecycle rule expires it after 35 days. The proof run at
04:01 UTC wrote `manual/2026-10-23T040156Z/`, one version per file.

### Why

- During the incident, two runs triggered by hand left `daily/2026-10-23/`
  with three versions per key. That is exactly what a backup planted with a
  leaked key looks like, so the restore drill refuses it.
- Runs by hand are still needed: after a password change, a key change, or
  before a risky operation.

### How

- **Tell them apart by the clock.** Railway starts a scheduled run and a run
  triggered by hand with the same command, so `backup.sh` reads the UTC hour
  once, at the start. The 20:00 hour is the nightly run; any other hour is
  manual, and never writes `monthly/`.
- **Rejected: a conditional write.** Uploading with `If-None-Match` and
  falling back to `manual/` would let a planted `daily/` key push the real
  nightly run aside, leaving the planted one as the only version.
- **Rejected: a variable.** Setting `BACKUP_MODE=manual` for each run means a
  redeploy per change, and forgetting to clear it diverts the nightly runs.
- **Stack first.** The owner updated the stack through a reviewed change set
  before the merge, so the new code never ran without its permission.

### Struggles

- **Two limits came with the clock.** A run triggered by hand at 20:xx UTC
  still collides with the nightly run, and a scheduled run Railway delays
  past 20:59 UTC lands in `manual/`. The next morning's alert reports the
  second, so it fails loudly.
- **A change set lists more than it changes.** Five resources showed as
  `Modify` only because they reference the bucket's ARN. Their `Dynamic`
  evaluation, with `ResourceAttribute` as the source, showed nothing really
  changed.

<!-- Owner: add anything about the decision or the proof run that the
records above miss. -->

### Where it stands

- Ticket 07 is done. The spec stays open only for ticket 03's AWS cost
  note. It now uses October's bill, due about 2026-11-03; October's
  month-to-date cost reads $0.00.
- `production-migrations` also waits on backlog ticket 03, recovering
  production from a backup.
