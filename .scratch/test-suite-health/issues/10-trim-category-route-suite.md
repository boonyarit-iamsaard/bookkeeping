# 10: Trim the category route suite to HTTP scope

**What to build:** `apps/server/src/features/categories/category.routes.integration.test.ts` (35 tests)
asserts only what the route layer owns. Tests that re-prove domain rules are
shown to be covered by the application suite (ported if not) and removed,
keeping exactly one representative per problem code per endpoint.

**Blocked by:** 03 (Migrate category route suite)

**Status:** resolved

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

## Comments

### 2026-09-20 — implementation

Problem codes each endpoint can emit (from `category.routes.ts` + `request-validation.ts`):

- `POST /v1/categories`: `unauthenticated`, `idempotency-key-required`, `bad-request` (malformed JSON), `invalid-command` (schema path via `createCommandMiddleware`, and application path via `toCategoryFieldError`), `idempotency-conflict`
- `GET /v1/categories`: `unauthenticated`
- `GET /v1/categories/{categoryId}`: `unauthenticated`, `not-found` (application null and malformed-id param middleware alike)
- `PATCH /v1/categories/{categoryId}`: `unauthenticated`, `bad-request`, `invalid-command` (schema path, and application path via `toCategoryUpdateFieldError`), `not-found`
- `GET /v1/categories/{categoryId}/usage`: `unauthenticated`, `not-found`
- `GET /v1/categories/usage`: `unauthenticated`
- `POST /v1/categories/defaults`: `unauthenticated`
- `DELETE /v1/categories/{categoryId}`: `unauthenticated`, `not-found`, `conflict` (`protected`, `has-children`, `in-use` all through `isRemovalBlocked`)

Classification table (application file: `packages/application/src/categories/category.integration.test.ts`):

| #   | describe                              | test title                                                                               | class      | problem code if R1           | keep / delete / keep-trimmed                                                                                                    | covering application test if D (or for a trimmed assertion)                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | POST /v1/categories                   | creates a parent, returns its representation, and gives its location                     | R6, R4     |                              | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 2   | POST /v1/categories                   | creates a child together with a new parent in one request                                | D          |                              | delete                                                                                                                          | `createCategory tree rules` :: "a missing parent is created with its child, or neither when the parent name is taken" (asserts the created parent's name/icon/`parentId: null` and the child's `parentId` = the created parent's id)                                                                                                                                   |
| 3   | POST /v1/categories                   | replays a normalized payload and conflicts on a changed payload                          | R5, R1     | idempotency-conflict         | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 4   | POST /v1/categories                   | does not consume an idempotency key when command validation rejects it                   | R5, R1     | invalid-command              | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 5   | POST /v1/categories                   | maps invalid, duplicate, protected, and cross-owner parents to field errors              | R2, R3     |                              | keep                                                                                                                            | Kept as R2: proves the `CATEGORY_ISSUE_POINTERS[field]` branch and the `#/parent` branch of `toCategoryFieldError`; every assertion is a pointer/code mapping                                                                                                                                                                                                          |
| 6   | POST /v1/categories                   | requires a usable idempotency key                                                        | R1, R5     | idempotency-key-required     | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 7   | POST /v1/categories                   | concurrent requests with one key create one category and replay it                       | D          |                              | delete                                                                                                                          | `createCategory` :: "concurrent retries with one key create one category and replay it"                                                                                                                                                                                                                                                                                |
| 8   | POST /v1/categories                   | rejects malformed JSON and anonymous requests with standard problems                     | R1, R1     | bad-request, unauthenticated | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 9   | GET /v1/categories                    | lists the signed-in owner's ordered trees with protected metadata                        | R6, R4, R3 |                              | keep-trimmed: drop the protected-set equality, the Food & Drink / Groceries shape assertions, and the parent-before-child order | `listCategories` :: "lists only the owner's ordered trees with protected metadata" (identical assertions). Kept: status, content-type, `page`, item count equal to the owner's rows, no overlap with the stranger's tree (R3)                                                                                                                                          |
| 10  | GET /v1/categories                    | does not provision an incomplete owner while reading                                     | D          |                              | delete                                                                                                                          | `listCategories` :: "does not initialize a missing tree while reading"                                                                                                                                                                                                                                                                                                 |
| 11  | GET /v1/categories                    | rejects an anonymous request with the standard problem                                   | R1         | unauthenticated              | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 12  | GET /v1/categories/{categoryId}       | returns one owned category as its tree lists it                                          | R6, R4     |                              | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 13  | GET /v1/categories/{categoryId}       | treats unknown, cross-owner, and malformed ids as not found alike                        | R1, R3     | not-found                    | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 14  | GET /v1/categories/{categoryId}       | rejects an anonymous request with the standard problem                                   | R1         | unauthenticated              | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 15  | PATCH /v1/categories/{categoryId}     | renames and re-icons in one save, leaving the tree position alone                        | R6, R4     |                              | keep-trimmed: drop the follow-up list and GET assertions                                                                        | `updateCategory` :: "a rename keeps the icon, and an icon change keeps the name, at either level" (asserts the listed row after the update). The response `toEqual` stays as the R4 assertion                                                                                                                                                                          |
| 16  | PATCH /v1/categories/{categoryId}     | lets Uncategorized change its icon but never its name                                    | R2, R1     | invalid-command              | keep-trimmed: drop the successful re-icon request and its two assertions                                                        | `updateCategory` :: "Uncategorized takes a new icon but never a new name". Kept as R2 + first `invalid-command` in this describe: the `protected` → `#/name` case of `toCategoryUpdateFieldError` is proven nowhere else                                                                                                                                               |
| 17  | PATCH /v1/categories/{categoryId}     | maps duplicate, invalid, and unknown-field commands to field errors                      | R2         |                              | keep-trimmed: drop the trailing "row unchanged" listing assertion                                                               | PORT (assertion-level): `updateCategory` :: "rejections match the creation rules without touching the row" asserted the foreign row untouched but not the owner's own rejected row; one `findCategory(...).toEqual(groceries)` assertion added there after the four rejections. Kept as R2: proves the `#/name` / `#/iconId` cases and the schema (strict-object) path |
| 18  | PATCH /v1/categories/{categoryId}     | treats unknown, cross-owner, and malformed ids as not found alike                        | R1, R3     | not-found                    | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 19  | PATCH /v1/categories/{categoryId}     | rejects malformed JSON and anonymous requests with standard problems                     | R1, R1     | bad-request, unauthenticated | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 20  | GET /v1/categories/{categoryId}/usage | reports the transactions a category holds and the children under a parent                | R6, R4     |                              | keep-trimmed: drop the Food & Drink (`children: 4`) and Restaurants (`0/0`) assertions                                          | `findCategoryUsage` :: "counts current transactions and children; refunds and deleted transactions do not count" (asserts a parent's children count and the deleted-transaction case). Kept: the Groceries response with status, content-type, and schema parse                                                                                                        |
| 21  | GET /v1/categories/{categoryId}/usage | treats unknown, cross-owner, and malformed ids as not found alike                        | R1, R3     | not-found                    | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 22  | GET /v1/categories/{categoryId}/usage | rejects an anonymous request with the standard problem                                   | R1         | unauthenticated              | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 23  | GET /v1/categories/usage              | counts each category's current transactions in one read                                  | R6, R4     |                              | keep                                                                                                                            | The single body equality is the serialization of `presentCategoryUsage` (route-owned); nothing to trim                                                                                                                                                                                                                                                                 |
| 24  | GET /v1/categories/usage              | never counts another owner's transactions                                                | R3         |                              | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 25  | GET /v1/categories/usage              | rejects an anonymous request with the standard problem                                   | R1         | unauthenticated              | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 26  | POST /v1/categories/defaults          | completes a signed-in owner's default set and reports what it seeded                     | R6, R4     |                              | keep-trimmed: drop the row-count growth assertion and the second (`seededKinds: []`) request + assertion                        | `initializeDefaultCategories` :: "repeating provisioning neither duplicates defaults nor overwrites customization" (second call → `[]`) and "a fresh user receives the complete default set…" (rows created). Kept: status, content-type, `{ seededKinds: ["income"] }`                                                                                                |
| 27  | POST /v1/categories/defaults          | rejects an anonymous request with the standard problem                                   | R1         | unauthenticated              | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 28  | POST /v1/categories/defaults          | concurrent retries by one owner seed each missing tree exactly once                      | D          |                              | delete                                                                                                                          | `initializeDefaultCategories` :: "concurrent provisioning of one owner seeds each tree exactly once" (seeded kinds across calls, tree length = both catalogs, which rules out a duplicated protected row)                                                                                                                                                              |
| 29  | POST /v1/categories/defaults          | one owner's retry never touches another owner's categories                               | D          |                              | delete                                                                                                                          | `initializeDefaultCategories` :: "provisioning one owner leaves other owners untouched" (same assertions: the other owner's tree empty, then seeded, equal sizes, disjoint ids). Session → owner wiring stays proven by row 26                                                                                                                                         |
| 30  | DELETE /v1/categories/{categoryId}    | removes an unused child with no response body and makes a repeat not found               | R6, R4, R1 | not-found                    | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 31  | DELETE /v1/categories/{categoryId}    | reassigns a removed child's transactions to its parent                                   | D          |                              | delete                                                                                                                          | `removeCategory` :: "a removed child hands its transactions to its parent"                                                                                                                                                                                                                                                                                             |
| 32  | DELETE /v1/categories/{categoryId}    | returns one stable conflict problem for protected and for a parent with children         | R1         | conflict                     | keep-trimmed: drop the "still listed" GET 200 check inside the loop                                                             | `removeCategory` :: "a parent is kept while any child exists; once childless its transactions fall back to Uncategorized" (the blocked parent is removed later, and Uncategorized is still in the tree at the end). Both blockers stay in the loop: they are two inputs to the one `isRemovalBlocked` mapping                                                          |
| 33  | DELETE /v1/categories/{categoryId}    | a transaction landing during the removal makes it a conflict or moves up, never orphaned | D          |                              | delete                                                                                                                          | `removeCategory` :: "removal racing a transaction assignment ends with the entry filed under a live category". `in-use` → `conflict` is the same `isRemovalBlocked` branch row 32 proves                                                                                                                                                                               |
| 34  | DELETE /v1/categories/{categoryId}    | does not disclose missing or another owner's categories                                  | R3         |                              | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |
| 35  | DELETE /v1/categories/{categoryId}    | rejects an anonymous request with the standard problem                                   | R1         | unauthenticated              | keep                                                                                                                            |                                                                                                                                                                                                                                                                                                                                                                        |

Judgment calls worth a reviewer's eye:

- Rows 5, 16, 17 each carry `invalid-command` after row 4 (POST) / row 16
  (PATCH) hold the R1 slot. Following the ticket-09 precedent, I kept them as
  R2 because each proves a route-owned pointer/code mapping branch
  (`toCategoryFieldError` name-field and `#/parent` cases;
  `toCategoryUpdateFieldError` `protected` case; its `#/name`/`#/iconId` cases
  plus the strict-object schema path). Only their side-effect assertions
  were trimmed.
- Titles were left as they are ("never add or rewrite"), so three now
  overstate what the test asserts: row 9 no longer asserts "ordered" or
  "protected metadata" (only the schema parse touches `isProtected`); row 16
  no longer sends the successful re-icon; row 20 no longer reads a parent's
  `children`. Retitle if wanted; I did not.
- Rows 13, 18, 21, 34: the "still intact afterwards" checks in the ownership
  tests were kept as part of R3, as in ticket 09. Row 32's "still listed"
  check was trimmed because it is a same-owner rule (a blocked removal changes
  nothing), not ownership.
- Row 2 deletes the only route test that sends the `parent: { create: … }`
  branch of the request-schema union on a success path; row 1 still proves
  the forwarding wiring and row 5 exercises the `existingId` branch. Same
  flag as ticket 09 rows 5/30, in case the reviewer wants a route-level
  "request variant reaches the application" check kept.
- Row 29 is a per-owner provisioning rule (no resource id is involved), so I
  classified it D rather than R3; the session-to-owner wiring of the endpoint
  is proven by row 26. Flagging because spec story 11 could be read to cover
  it.
- Gap noticed, not filled (out of scope: no new tests): `POST /v1/categories`
  has no test that trips the schema path of `createCommandMiddleware` (a
  missing `kind` or an unknown field); its only `invalid-command` tests go
  through the application path. PATCH's row 17 does cover the schema path
  for its endpoint.
- One assertion-level port (row 17): the application test "rejections match
  the creation rules without touching the row" asserted the foreign row was
  untouched but never the owner's own rejected row; one
  `findCategory(...).toEqual(groceries)` assertion was added after its four
  rejections. No other application test changed.

**Applied.** Deleted rows 2, 7, 10, 28, 29, 31, 33 (7 tests). Trimmed rows
9, 15, 16, 17, 20, 26, 32 (assertions, and the requests that existed only for
them, removed; titles and kept assertions unchanged). Removed the then-unused
`filedCategory` helper, the `createCategoryForTest` and `databaseError`
imports, and the `committed` destructure (its only users were rows 7, 28, 33).
`countCategories` stays (row 9). No production code changed.

Per-endpoint coverage after the trim (R6 = happy path; R1 = one test per emittable problem code):

- `POST /v1/categories`: R6 row 1; R1 `unauthenticated` row 8, `idempotency-key-required` row 6, `bad-request` row 8, `invalid-command` row 4, `idempotency-conflict` row 3.
- `GET /v1/categories`: R6 row 9; R1 `unauthenticated` row 11.
- `GET /v1/categories/{categoryId}`: R6 row 12; R1 `unauthenticated` row 14, `not-found` row 13.
- `PATCH /v1/categories/{categoryId}`: R6 row 15; R1 `unauthenticated` row 19, `bad-request` row 19, `invalid-command` row 16, `not-found` row 18.
- `GET /v1/categories/{categoryId}/usage`: R6 row 20; R1 `unauthenticated` row 22, `not-found` row 21.
- `GET /v1/categories/usage`: R6 row 23; R1 `unauthenticated` row 25.
- `POST /v1/categories/defaults`: R6 row 26; R1 `unauthenticated` row 27.
- `DELETE /v1/categories/{categoryId}`: R6 row 30; R1 `unauthenticated` row 35, `not-found` row 30, `conflict` row 32.

Ran (one package at a time):

- `pnpm --filter @bookkeeping/application exec vitest run` — 172 passed (unchanged count; the port added an assertion, not a test)
- `pnpm --filter @bookkeeping/server exec vitest run` — 195 passed (before: 202; −7). JSON reporter, `category.routes.integration.test.ts`: 35 tests / 2777 ms before → 28 tests / 1503 ms after when run alone (file `endTime − startTime`); 2113 ms inside the full-suite run, where it shares the container with the other files
- `pnpm --filter @bookkeeping/server types:check`, `pnpm --filter @bookkeeping/application types:check`, `pnpm lint` — clean

**2026-09-20 — closed.** Resolved in `50ce770` (test: trim the category route suite to http scope). Status line was stale after the commit landed.
