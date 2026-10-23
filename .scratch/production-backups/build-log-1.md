# Build log: production backups, part 1

Raw material for a future article on boonyarit.me about this feature. One
dated entry per working session, each answering **What** happened, **Why**,
**How**, and the **Struggles** we overcame, with the numbers that came up.

This repository is public, so every entry must be safe to publish: no
secrets, account IDs, hostnames beyond the public ones, or real financial
figures. Screenshots stay in a private folder outside the repository; an
entry only names them.

Entries after the storage stack went live on 2026-10-18 continue in
`build-log-2.md`.

## 2026-10-17: from "where are we?" to a spec

### What

The day started as housekeeping and ended with a decided design. Six
dependency pull requests were merged, a stale ticket and a stale design note
were closed, and then the recap of milestone one exposed the real problem:
the production database had held the real ledger for three weeks with no
copy anywhere outside Railway. A grilling session turned that into
`spec.md`, six tickets and ADR 0013. A manual encrypted dump was taken the
same day as a stopgap. The architecture diagram for the article then led to
a small diagram toolchain (`pnpm diagrams`), and verifying that change
surfaced a flaky database test, which was diagnosed and fixed in #29. No
backup code exists yet: the day produced the design, the tooling, and a
clean `main` to build on.

### Why

- ADR 0008 said real data must wait for off-provider backups. In practice,
  the "trial" had quietly become the real ledger on 2026-09-27, and nobody
  went back to the plan. The written plan still said the trial data would be
  wiped, while PRODUCT.md said the real ledger was in it.
- ADR 0009 relies on backups to undo a bad migration, so production
  migrations had to wait for a proven restore. That split the milestone into
  two specs: backups first, migrations second.
- AWS instead of the originally planned Cloudflare R2: the owner is preparing
  for AWS SAA-C03, and at this size the cost is effectively zero, so the
  backup doubles as real practice with S3, IAM, Organizations, Object Lock,
  EventBridge, Lambda, SNS and CloudFormation.

### How

- **Measured before designing.** One read-only query in Railway's query tab:
  PostgreSQL 18.6, 8.7 MB, about 40 transactions after three weeks, and no
  Drizzle migrations table, because production only ever received `db:push`.
  At about two transactions a day, a nightly backup loses at most a few
  entries, so point-in-time recovery was not worth it.
- **Decided in rounds.** Each round asked only the questions whose
  prerequisites were settled, each with a recommended answer. The owner
  accepted every recommendation; the main debate was where the job runs.
- **Where the job runs.** GitHub Actions and AWS Lambda both avoid
  long-lived keys through OIDC and IAM roles, but both need the database
  reachable from the internet all the time. A Railway cron service keeps the
  database on the private network and needs one AWS key, which is made
  harmless: it can only add objects, never read, list or delete.
- **Defence in layers.** `age` encryption before upload, so neither Railway,
  AWS nor a leaked key can read a backup. S3 Object Lock in compliance mode
  for 35 days, so nobody, not even root, can delete a recent backup. A
  dedicated AWS account under an Organization, so exam practice cannot touch
  it. Railway's own volume backups stay on as a faster first layer.
- **Proof without production.** Each backup carries an encrypted manifest of
  per-table row counts and checksums from the same snapshot. The restore
  drill compares against that, so proving a backup never needs a connection
  to the live database.
- **Stopgap.** `pg_dump` ran from the `postgres:18-alpine` image through a
  temporary TCP proxy, piped straight into `age`, and the proxy was closed
  afterwards. The database URL was read with `read -rs`, so it never reached
  shell history.

### Struggles

- **Dependabot closed its own pull request.** After a rebase it closed the
  `apps/web` node image bump as "up-to-date", because the same digest had
  just landed in `apps/server`. `apps/web` was still on the old digest. A
  one-line pull request fixed it after a `@dependabot reopen` went
  unanswered.
- **Strict branch rules turn merges into a queue.** With "require branches
  to be up to date", every merge put the remaining pull requests behind
  `main`. Each one needed a rebase and a fresh run of the checks, and
  Dependabot replaced two of its grouped pull requests rather than rebasing
  them.
- **Giving an agent GitHub access without giving it everything.** A
  fine-grained token scoped to one repository has no "Checks" permission
  (that is for GitHub Apps), which did not matter because the repository is
  public. The token lives in a file and a shell function injects it into each
  `gh` call, so it never sits in the environment of other processes.
- **Railway's query tab and several statements.** It showed no rows for a
  script of several statements; rewriting them as one `union all` query
  worked.
- **The secret key in a screenshot.** Checking the new `age` key with `cat`
  put the private key into a screenshot shared during the session. Nothing
  depended on it yet, so the fix was cheap: generate a new key, re-encrypt
  the one dump with it, and treat the old key as burned. Lesson: print only
  the public key (`age-keygen -y`).
- **The plan said "wipe the trial data".** Three weeks of real use made that
  wrong. The migrations spec now has to adopt the existing schema as its
  baseline instead of starting from an empty database.
- **The diagram went through four approaches.** D2 laid itself out but read
  as one very wide strip or one very tall column until the `dagre` engine
  and stacked groups gave a usable shape, and it read the `$` in "Budgets ·
  $1 alert" as a substitution. Mermaid cut off long group titles and placed
  the owner inside the AWS box. Hand-written SVG finally looked like the
  clean Eraser style the article wanted, but every box and line was placed
  by coordinates. The final approach keeps that look and lets the browser do
  the layout: the diagram is an HTML page styled by a small shared kit,
  edges are declared by the ids they join and drawn after layout, and
  `pnpm diagrams` renders light and dark PNGs with the Playwright Chromium
  the browser tests already install. Two snags on the way: Chromium refuses
  module scripts from `file://` pages, and the repository root is CommonJS,
  so the render script cannot use top-level `await`. Mermaid stays as the
  fallback for quick diagrams inside GitHub documents.
- **A flaky test that only failed under load.** `pnpm run ci` failed now and
  then with `relation "users" does not exist`, never when the database
  package ran alone. Waiting for chance gave no usable signal: 0 failures in
  17 ordinary and loaded runs. The breakthrough was making the slowness
  deliberate: a script throttled the test Postgres container to 5% of one CPU
  with `docker update --cpus`, after setup had migrated it, and the failure
  appeared every time in 17 seconds. The cause was a test that dropped the
  shared schema, ran past Vitest's 5 s timeout, and left the next test file
  with an empty database. The fix gave that test its own throwaway database
  and a longer timeout for the two migration tests only. Lesson for the
  article: a backup restore drill and a flaky-test hunt need the same thing,
  a loop that turns "sometimes" into "every time".

### Numbers

| Item                                | Value                              |
| ----------------------------------- | ---------------------------------- |
| Database size                       | 8.7 MB (PostgreSQL 18.6)           |
| Ledger after three weeks            | ~40 transactions, 7 wallets        |
| Estimated S3 cost                   | under $0.01 a month                |
| Budget alert                        | $1 a month (AWS), within $10 total |
| Railway's own backups               | kept 6, 27 and 89 days             |
| Most data a failure can lose        | one day                            |
| Off-provider retention              | 35 days nightly, 12 months monthly |
| Dependency PRs merged before design | 5 from Dependabot, 1 by hand       |
| Diagram approaches tried            | 4 (D2, Mermaid, SVG, HTML kit)     |
| Flaky test, ordinary runs           | 0 failures in 17                   |
| Flaky test, throttled container     | 3 of 3 failures, 17 s per run      |

Screenshots (private): Railway query tab with the database stats; terminal
showing the manual dump's table list. Committed figures: the architecture
diagram in `diagrams/`, light and dark.

### Where it stands

- Owner, ticket 01: the AWS Organization, the `backups` account, Identity
  Center with MFA, Railway's own backup schedules, and three loose ends from
  today: replace the exposed `age` key, re-encrypt the manual dump, and
  confirm the temporary TCP proxy is off.
- Agent, ticket 02 next: the CloudFormation template for the bucket, the
  uploader and the budget.
- The branch `feat/production-backups` holds the spec, tickets, ADR, build
  log, diagram kit and diagram; it is not pushed yet.

## 2026-10-18: the AWS foundation, by hand

### What

Ticket 01 was the owner's to perform, so the agent wrote a runbook from the
current AWS and Railway docs and then walked through it one step at a time,
checking each result read-only. The old personal AWS account became the
management account of an Organization with a new `backups` member account
that has no root credentials at all. IAM Identity Center gives the owner one
MFA-protected sign-in to both accounts, in the browser and in the CLI, with no
access keys on disk. The `age` key exposed in a screenshot the day before was
replaced and the manual dump re-encrypted. The temporary TCP proxy was
confirmed gone. Railway's own backups were dropped: they need the Pro plan.
The session ended with a learning note and a second diagram of how the AWS
pieces relate: `notes/aws-foundation-lessons.html` and
`diagrams/aws-access.diagram.html`.

### Why

- Root credentials are the one thing no policy can limit. Removing them from
  `backups` and keeping the management account's root for break-glass use
  leaves the everyday path, Identity Center with MFA, as the only door.
- The backup job in later tickets needs a place to upload to and a way for
  the owner to restore; both start from these accounts and CLI profiles.
- A private key that has appeared in a screenshot is burned, even if the
  screenshot is deleted. Every backup encrypted to it would be readable by
  whoever saw it.

### How

- **Runbook first, then companion.** Every step had a goal, the exact
  console path or command, what to expect, a read-only verify check, how to
  undo it, and the official page behind it. During the run the agent ran the
  checks itself where it could and asked for a screenshot where it could not.
- **Order chosen for a reason.** Centralized root access went on before the
  member account was created, so the account was born with no root password,
  keys or MFA, and nothing needed deleting afterwards.
- **Proof from the API, not the console.** Once the CLI profiles existed, one
  batch of read-only calls confirmed the feature set, both accounts, the root
  access features, the Identity Center instance and root's MFA. An audit-only
  `sts:AssumeRoot` session, kept inside a subshell, showed `backups` has no
  root password, keys, MFA or certificates.
- **Key rotation without plaintext on disk.** The dump was re-encrypted in a
  single pipe and both decryptions hashed to the same value. The new key went
  to the password manager through the clipboard, never the screen, and a
  passphrase-encrypted copy went to a cloud drive. Both copies were tested
  against the dump before the old key was deleted.

### Struggles

- **The console said done; the API said nothing was on.** Turning on IAM's
  trusted access from Organizations made the Root access management page show
  the account tree, with no capability choices left to make. The API listed
  no enabled features. Two CLI calls from CloudShell turned them on. Had the
  `backups` account been created then, it would have been born with root
  credentials. Lesson: check with the API before any step that cannot be
  undone.
- **A plan limit nobody checked.** The spec assumed Railway's Hobby plan
  includes volume backups. The Backups tab disagreed: creating backups and
  schedules needs Pro. The owner kept Hobby and dropped the criterion; the
  off-Railway job was always the real requirement.
- **A public repo and a chatty run log.** The run log picked up account IDs,
  emails and the portal URL as the steps were ticked. They were scrubbed
  before the first commit, and the runbook skill is getting a check for it.
- **Names on the screen.** The production database service is called
  `database`, not `Postgres` as the runbook assumed; and two AWS sign-ins
  looked alike in the password manager and the authenticator until both were
  renamed with matching labels.

### Numbers

| Item                                       | Value                   |
| ------------------------------------------ | ----------------------- |
| Runbook steps                              | 16 (15 done, 1 skipped) |
| Ticket criteria                            | 9 (8 passed, 1 dropped) |
| AWS accounts                               | 2                       |
| Root credentials in `backups`              | 0                       |
| Access keys on the owner's machine         | 0                       |
| Identity Center session length             | 1 hour                  |
| Copies of the new `age` key                | 2, both tested          |
| Steps where the console differed from docs | 2                       |
| AWS cost so far                            | $0                      |

Screenshots (private): the AWS console pages for each step, the access
portal, and the terminal output of the CLI checks. Committed figures: the
AWS access diagram in `diagrams/`, light and dark, and the learning note in
`notes/`.

### Where it stands

- Ticket 01 is done. Until ticket 04 ships, the re-encrypted 2026-10-17 dump
  is the only copy of the data outside Railway.
- Agent, ticket 02 next: the CloudFormation template for the bucket, the
  uploader and the budget.

## 2026-10-18: the storage stack, as one template

### What

The agent wrote `infra/aws/backups.yaml`, the CloudFormation stack the owner
deploys in ticket 03: the bucket with versioning, compliance-mode Object Lock
for 35 days, lifecycle rules and a TLS-only policy; the
`bookkeeping-backup-uploader` user, which can only `s3:PutObject` under
`daily/` and `monthly/`; and a $1 monthly budget. `infra/aws/README.md`
holds the deploy command, the access-key steps and the uploader checks. No
AWS resources were created, and the agent held no AWS credentials.

### Why

- One template the owner deploys by hand keeps the AWS side reviewable in
  the repository, and CI never needs AWS credentials (ADR 0013).
- The template names no region or account, so the same file could rebuild
  the stack elsewhere; the region lives only in the deploy command.

### How

- **Lifecycle under Object Lock.** Expiry on a versioned bucket only adds a
  delete marker. The locked version becomes noncurrent and is removed one
  day later, but never before its 35 days pass. The delete marker rule
  cannot share a rule with day-based expiry, so it sits with the noncurrent
  rule, which covers the whole bucket.
- **Retain the bucket.** The stack's bucket has `DeletionPolicy: Retain`,
  because compliance mode would block deleting it anyway while any version
  is locked.
- **Linting without a dependency.** `cfn-lint` has no official container
  image, so it runs inside a digest-pinned `python:3.13-alpine` with a
  pinned `cfn-lint`, thrown away after each run. A deliberately misspelt
  property proved the run checks something.

### Struggles

- **A key with nowhere to go.** The first README told the owner to paste the
  new key into the Railway `backup` service, which ticket 04 creates. The
  review caught it, so the owner now creates the service empty first. The
  uploader checks for ticket 03 read the key into the shell with `read -s`,
  so it never reaches a file.

### Where it stands

- Ticket 02 is done. Owner, ticket 03 next: deploy the stack, create the
  key, and prove the bucket refuses the uploader's reads and the owner's
  deletes.

## 2026-10-18: the storage stack goes live

### What

The owner deployed `infra/aws/backups.yaml` to the `backups` account in
`ap-southeast-1` and created the uploader's access key. The agent wrote a
runbook from the current AWS and Railway docs and checked each step with
read-only calls. The key went straight from the IAM page into a new, empty
Railway `backup` service, where the secret is sealed. A probe object then
proved the protections: the uploader can write but not list, read or
delete, and even the owner can't delete a locked version.

### Why

- Ticket 04's job needs somewhere to write and a key to write with. Proving
  the refusals now means a leaked key is known to be harmless before any
  real backup depends on it.
- Sealing the secret in Railway means nobody can read it back, from the UI,
  the API or the CLI. The yearly replacement overwrites it instead.

### How

- **A name nobody else can take.** Since the template was written, S3 has
  gained an account regional namespace: a bucket name ending in
  `-<account id>-<region>-an` can only ever belong to that account, even
  after deletion. The template switched to `BucketNamePrefix` with
  `BucketNamespace: account-regional` before the deploy. Because the full
  name contains the account ID, the repository records it only as a
  placeholder.
- **Review before the irreversible step.** `deploy --no-execute-changeset`
  created a change set with four resources, which was read back before
  executing it. Nothing could be undone once an Object Lock bucket existed.
- **The key in a subshell.** The uploader checks read the key with
  `read -rs` inside `( … )`, so it vanished when the block ended. The
  values were pasted with the console's copy icons, without ever pressing
  **Show**.
- **A real refusal, not a delete marker.** A delete without a version ID
  succeeds on a versioned bucket and only hides the object. The owner's
  check named the version ID, and S3 answered `Access Denied because object
protected by object lock`.

### Struggles

- **An empty variable.** The runbook's first verification block used the
  bucket name variable without setting it, so every bucket check failed with
  `Invalid bucket name ""`. It now reads the name from the stack output
  first.
- **The checksum question.** S3 rejects uploads to an Object Lock bucket
  that carry no checksum. The probe's metadata showed a `CRC64NVME`
  checksum, which the CLI sends by default, so no flag is needed on this
  machine. Ticket 04 still has to confirm the same for Alpine's `aws-cli`.
- **Docs that trail the console.** Railway's staged-changes dialog offers
  only **Deploy Changes**, even for a service with no source, and the AWS
  console opened in another region by default. Neither mattered, but the
  runbook now says so.

### Where it stands

- Ticket 03 has five of six criteria ticked. The first month's AWS cost is
  recorded once November's bill is issued.
- Agent, ticket 04 next: the backup job in `apps/backup/`, pointed at the
  `backup` service, which already holds the key.
