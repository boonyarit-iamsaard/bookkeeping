# Build log: production backups

Raw material for a future article on boonyarit.me about this feature. One
dated entry per working session, each answering **What** happened, **Why**,
**How**, and the **Struggles** we overcame, with the numbers that came up.

This repository is public, so every entry must be safe to publish: no
secrets, account IDs, hostnames beyond the public ones, or real financial
figures. Screenshots stay in a private folder outside the repository; an
entry only names them.

## 2026-10-17: from "where are we?" to a spec

### What

The day started as housekeeping and ended with a decided design. Six
dependency pull requests were merged, a stale ticket and a stale design note
were closed, and then the recap of milestone one exposed the real problem:
the production database had held the real ledger for three weeks with no
copy anywhere outside Railway. A grilling session turned that into
`spec.md`, six tickets and ADR 0013. A manual encrypted dump was taken the
same day as a stopgap.

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

- **The first diagram took three layouts.** D2's `elk` engine drew the
  architecture either as one very wide strip or as one very tall column;
  `dagre` with the Railway and AWS groups stacked inside gave a readable
  shape. D2 also read the `$` in "Budgets · $1 alert" as a substitution until
  the label was single-quoted, and the first S3 icon URL pointed at an icon
  that does not exist.

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

Screenshots (private): Railway query tab with the database stats; terminal
showing the manual dump's table list.
