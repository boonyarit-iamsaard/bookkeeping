# 10: Trim the category route suite to HTTP scope

**What to build:** `apps/server/src/features/categories/category.routes.integration.test.ts` (35 tests)
asserts only what the route layer owns. Tests that re-prove domain rules are
shown to be covered by the application suite (ported if not) and removed,
keeping exactly one representative per problem code per endpoint.

**Blocked by:** 03 (Migrate category route suite)

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

## What the route suite owns (from `../spec.md`)

R1. Status code + problem-details mapping — ONE test per problem code the
endpoint can emit (`bad-request`, `conflict`, `forbidden`,
`idempotency-conflict`, `idempotency-key-required`, `invalid-command`,
`not-found`, `unauthenticated`, as applicable).
R2. Request validation → field-error mapping (per body-accepting endpoint).
R3. Authentication / ownership enforcement at the boundary (anonymous → 401;
another owner's resource → whatever the route returns today).
R4. Response serialization against the exported Zod response schemas.
R5. Idempotency-key HTTP semantics (header required, replay, conflict, key
not consumed on application-level rejection).
R6. One happy-path round trip per endpoint.
D. Domain rule proven through HTTP — NOT owned here.

## Steps

1. **Classification table first.** Before editing, append under
   `## Comments` one row per existing test:
   `| describe | test title | class (R1–R6 or D) | problem code if R1 | keep / delete / keep-trimmed | covering application test if D |`.
   Rules:
   - A test is R1 only if it is the FIRST test in its endpoint's describe for
     that problem code; later tests for the same code are D.
   - A test that asserts both a mapping and rule details (e.g. the exact
     refund cap arithmetic in the body) is `keep-trimmed`: keep the request
     and the status/problem-code assertion, delete rule-detail assertions.
   - Everything classified D must name a covering application test in
     `packages/application/src/categories/category.integration.test.ts`, or be marked PORT.
2. **Port** every PORT row into the application suite (copy body, adapt
   imports/fixtures, keep title).
3. **Delete** every `delete` row. **Trim** every `keep-trimmed` row as
   described — remove assertions only, never add or rewrite.
4. Remove helpers and imports that became unused.

## Verify

- `pnpm --filter @bookkeeping/application exec vitest run` passes; record
  count.
- `pnpm --filter @bookkeeping/server exec vitest run` passes; record count
  and this file's duration from the JSON reporter.
- Every endpoint describe still has ≥1 R6 test and ≥1 test per problem code
  it can emit (state this explicitly in Comments per endpoint).
- `pnpm --filter @bookkeeping/server types:check`,
  `pnpm --filter @bookkeeping/application types:check`, `pnpm lint` pass.

## Stop and ask

- You cannot tell which problem code an endpoint emits for a case (look at
  the routes module and `apps/server/src/core/http/problem-details.ts`
  first; ask only if still unclear).
- A `keep-trimmed` test would become meaningless after trimming.
- A D scenario has no covering application test and cannot be ported by
  copying.

- [ ] Classification table in Comments covers all 35 tests
- [ ] Every D row resolved to a covering test or a port; ports added
- [ ] Deletions and trims applied; per-endpoint R6 and per-problem-code R1 present
- [ ] Both suites pass; counts and duration recorded
- [ ] Types and lint clean
