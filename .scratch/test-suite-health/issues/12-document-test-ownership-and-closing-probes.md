# 12: Document test ownership and run the closing probes

**What to build:** The ownership rule this effort enforced is written into
the house style, and two probes confirm the effort met its goals: a
changed domain rule turns red in the owning layer only, and `pnpm test`
finishes within budget.

**Blocked by:** 07 (Retire web history test), 09 (Trim wallet route suite),
10 (Trim category route suite), 11 (Trim transaction route suite)

**Status:** ready-for-agent

## Ground rules (every ticket in this effort)

- Read `../spec.md` and `../decisions.md` first. Do only what this ticket says.
- Never touch: `apps/web/tests/e2e/**`, `CONTEXT.md`, `docs/adr/**`, anything under
  `packages/database/src/**` except test helpers already named in this ticket,
  database migrations, `turbo.json`, any `vitest.config.mts`.
- Never change production code unless this ticket names the exact file.
- Never change an assertion in a kept test unless this ticket says to.
- Run test suites for ONE package at a time, never two concurrently
  (memory limit, see `CLAUDE.md`). Never run Playwright or Sonar.
- When done, append a `## Comments` entry to this file: what you ran, the
  test counts before/after, anything you were unsure about. Do not mark the
  checkboxes yourself; the reviewer does.
- If any "Stop and ask" trigger fires, write the question under `## Comments`
  and stop. Do not guess.

## Steps

1. Add a section `## Test ownership` to `docs/code-conventions.md`, after
   the existing paragraph about test scope in filenames. Content, in the
   file's existing prose style (short paragraphs, no bullets unless the
   surrounding sections use them):
   - The application package owns business-rule coverage; other layers may
     rely on a rule in a fixture but never assert it.
   - The server route suite asserts six things (list R1–R6 from
     `../spec.md`, one clause each); one representative test per problem
     code per endpoint; domain rules through HTTP are out.
   - Route integration tests provision owners through the test
     authentication gateway; real Better Auth over HTTP is covered by the
     gateway integration test only.
   - Web integration tests exist only for the temporary Next.js adapter's
     own boundary (session), until the adapter is removed.
   - Budget: `pnpm test` (Turborepo, parallel) completes in ≤ 60 s on the
     development machine; checked by hand, not gated in CI.
     Do not restate the reasoning at length; two sentences of "why" at most.
2. **Mutation probe.** In `packages/domain/src/transactions/transaction.types.ts`
   change `MAX_NOTE_LENGTH = 200` to `2000`. Run, one package at a time:
   `pnpm --filter @bookkeeping/application exec vitest run`,
   `pnpm --filter @bookkeeping/server exec vitest run`,
   `pnpm --filter @bookkeeping/web exec vitest run`.
   Record every failing test (file :: title) in Comments. Then
   `git checkout -- packages/domain/src/transactions/transaction.types.ts`
   and confirm `git status` shows no change to that file.
   Pass condition: failures only in the application suite, at most one
   route test (the R1/R2 representative), and the web form-schema unit test.
   Baseline before this effort: 7 failures across 3 packages.
3. **Budget probe.** Run `time pnpm test` three times (this is the ONLY step
   in the effort that runs packages concurrently; run nothing else
   meanwhile). Record the three wall times and the median in Comments.
   Pass condition: median ≤ 60 s. Baseline ≈ 81 s.
4. `pnpm format:check` and `pnpm lint:md` pass on the edited markdown.

## Stop and ask

- The mutation probe fails its pass condition — list the offending tests and
  stop; do not delete them yourself.
- The budget probe median is > 60 s — record the per-package durations and
  stop; `../decisions.md` D7 says container sharing is the next lever
  and is a separate decision.

- [ ] `## Test ownership` section added; format and markdownlint clean
- [ ] Mutation probe recorded and passing; mutated constant reverted
- [ ] Budget probe: three runs + median recorded; median ≤ 60 s

## Comments

**2026-09-20 — agent run.** Step 1 done; steps 2 and 3 both fire a
"Stop and ask" trigger. Stopping; nothing deleted, nothing guessed.

### Step 1 — `## Test ownership` section

Added to `docs/code-conventions.md` after the test-scope-in-filenames
paragraph. `pnpm format:check` and `pnpm lint:md` pass.

### Step 2 — Mutation probe (`MAX_NOTE_LENGTH` 200 → 2000)

Ran one package at a time. Failures:

- application (3 failed / 172):
  - `src/transactions/transaction-create.integration.test.ts :: createTransaction > rejects invalid dates, bounded values, and dates outside wallet history`
  - `src/transactions/transaction-create.integration.test.ts :: createTransaction > a note over 200 characters is rejected`
  - `src/transactions/transaction-update.integration.test.ts :: updateTransaction > rejected edits change nothing and record no history`
- server (2 failed / 183):
  - `src/features/transactions/transaction.routes.integration.test.ts :: POST /v1/transactions > does not consume a key after application validation and maps field failures`
  - `src/features/transactions/transaction.routes.integration.test.ts :: PUT /v1/transactions/{transactionId} > maps invalid update input to field errors`
- web (1 failed / 41):
  - `src/features/transactions/transaction-form-schema.unit.test.ts :: transaction form schema > rejects a note over 200 characters`

Total 6 failures across 3 packages (baseline 7). Constant reverted with
`git checkout --`; `git status` shows no change to
`transaction.types.ts`.

**Stop and ask (mutation):** the pass condition allows at most one route
test; two went red. Both use `"x".repeat(201)` to obtain the
`note-too-long` field error as the `invalid-command` representative — once
for POST (create) and once for PUT (update). Neither asserts the rule's
value; both assert the `{ pointer: "#/note", code: "note-too-long" }`
mapping. Options: (a) accept two reds as "one representative per endpoint"
(the section I wrote says "per problem code per endpoint", which is the
wording in this ticket's step 1), or (b) change one of them to use a
different field failure (e.g. amount or date) so only one route test
depends on the note length. I did not change either test.

### Step 3 — Budget probe

Note: `pnpm test` (`turbo run test`) hits the Turborepo cache after the
first run (0.4 s), so timings use `pnpm turbo run test --force`.
Nothing else ran meanwhile. Machine: 2 CPUs, 5 GB RAM (WSL2).

| Run | Wall    | domain | auth   | database | web    | application | server  |
| --- | ------- | ------ | ------ | -------- | ------ | ----------- | ------- |
| 1   | 146.9 s | 1.7 s  | 41.4 s | 64.2 s   | 72.8 s | 126.6 s     | 134.0 s |
| 2   | 159.6 s | 3.0 s  | 30.1 s | 57.6 s   | 80.9 s | 141.9 s     | 146.3 s |
| 3   | 138.0 s | 1.6 s  | 59.1 s | 34.6 s   | 72.7 s | 116.3 s     | 126.9 s |

**Median: 146.9 s.** Fails the ≤ 60 s pass condition.

Standalone (one package at a time, same session), for comparison with
`facts.md`:

| Package     | facts.md (before) |    now | tests before → now |
| ----------- | ----------------: | -----: | ------------------ |
| server      |            80.8 s | 45.0 s | 209 → 183          |
| application |            31.2 s | 34.8 s | 137 → 172          |
| web         |            25.7 s | 18.2 s | 90 → 41            |

**Stop and ask (budget):** the "baseline ≈ 81 s" in the spec is the server
package's _standalone_ wall time from `facts.md`, which measured packages
sequentially. The spec assumed turbo-parallel wall ≈ slowest package. On
this 2-core machine, running six vitest processes and five Postgres
containers at once roughly triples every package's duration (import phase
dominates: 57–64 %), so parallel `pnpm test` is slower than the sequential
sum (~150 s vs ~140 s). The per-package goal was met (server −44 %), but the
budget as written cannot be met by trimming tests; the lever is
concurrency (turbo `--concurrency`, or container sharing per D7), which is
a separate decision. The conventions section states the 60 s budget as
written in this ticket; it should be revisited once the decision is made.

### Step 4

`pnpm format:check` and `pnpm lint:md` pass.

**2026-09-20 — decisions resolved with the user.**

### Mutation probe: accepted as-is

The two red route tests (POST and PUT) each use the long note only to
obtain the `invalid-command` representative for their endpoint; neither
asserts the 200-character rule. This matches the convention as written
("one representative per problem code per endpoint"); the step 2 pass
condition ("at most one route test") was stricter than the convention it
was checking. No test changed. The probe otherwise passes: business-rule
failures are confined to the application suite plus the web form-schema
unit test.

### Budget probe: budget raised to ≤ 180 s

Before deciding, tested whether Turborepo parallelism was the cost. Three
`pnpm turbo run test --force --concurrency=N` runs each, nothing else
running:

| concurrency | run 1   | run 2   | run 3   | median  |
| ----------- | ------- | ------- | ------- | ------- |
| unlimited   | 146.9 s | 159.6 s | 138.0 s | 146.9 s |
| 2           | 135.9 s | 193.1 s | 150.2 s | 150.2 s |
| 1           | 164.2 s | 160.5 s | 169.9 s | 164.2 s |

Capping does not help and fully sequential is slower, so contention between
packages is not the cost; parallel wall ≈ sum of per-package standalone
times, which is import/transform time. Neither `--concurrency` nor
container sharing (D7) would close a ~90 s gap. Decision: keep the runner
as-is and set the budget at ≤ 180 s (median 146.9 s passes). Updated the
`## Test ownership` paragraph in `docs/code-conventions.md` and amended D5
in `../decisions.md`; D7 unchanged.

Two of the three concurrency-2 runs exited non-zero; output was not
captured and a fourth captured run passed. An intermittent failure under
that scheduling exists but was not identified. The six unlimited and
sequential runs across both sessions all passed.

`pnpm format:check` and `pnpm lint:md` pass.

**2026-09-20 — two-axis review applied.** Standards found one factual
error: the conventions and D6 said real Better Auth over HTTP is covered by
the gateway test _only_; `api-contract.integration.test.ts` also signs up
through real auth (spec, "Authentication gateway for route tests"). Fixed
both. Both axes flagged the representative-test granularity stated three
ways (conventions "per problem code per endpoint", D2/D4 "per error class",
spec "per problem code the feature can emit"); aligned D2, D4 and the spec
to per endpoint, the reading under which the mutation result was accepted.
Also: budget amendments pointed from the spec to D5, D7 amended to say the
60 s miss was resolved by D5, the D5 concurrency sentence made to say what
the numbers say, the "Helpers shared by" paragraph moved back under
filenames, and the hardware note dropped from the conventions (D5 keeps it).
Remaining review notes not acted on: Step 3 ran `pnpm turbo run test
--force` rather than the literal `time pnpm test` (cache); the two
uncaptured non-zero `--concurrency=2` exits are recorded above but not
tracked as a ticket.
