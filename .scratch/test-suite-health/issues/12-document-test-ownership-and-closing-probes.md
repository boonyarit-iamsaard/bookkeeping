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
