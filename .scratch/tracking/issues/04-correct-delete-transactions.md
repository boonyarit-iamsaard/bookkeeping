# 04: Correct and delete transactions

**What to build:** Open income/expense records from detail, correct their fields, or delete mistakes, while balances update and internal change history remains honest.

**Blocked by:** 02: Record income and expenses reliably.

**Status:** done

## Acceptance criteria

- [x] Provide a full-screen edit experience with fixed type and an explanation that changing type requires delete/recreate. Existing wallet/amount/category/date/note values are loaded accurately.
- [x] Permit valid field edits subject to ownership, exact amount/note limits, correct category tree, Bangkok future-date rules, and affected wallet opening dates.
- [x] Editing replaces financial effects; deletion removes the transaction from normal list/detail, current balances, and applicable historical calculations. Neither action adds a separate visible reversal entry.
- [x] Preserve original recording time and retain internal change history for successful edits/deletes atomically with the financial change. Failed operations leave no partial effect or successful-change history.
- [x] Retain enough durable submission receipt information that a late create retry never restores old values or recreates a deleted transaction.
- [x] Delete is available from edit's destructive action with clear feedback. Keep values on errors and announce field validation; successful edits return to the list with the row highlighted, and deleted records no longer appear normally.
- [x] Reuse the category interaction established by 02; when 03's custom category flow is available it works on edit too, without making 03 a prerequisite.
- [x] Keep extension points for later transfer/refund-specific corrections without prebuilding their feature layers. Apply impeccable to the confirmed edit brief, including fixed-type labeling, Bangkok recording footer, keyboard completeness, and phone/desktop verification.
- [x] Use PostgreSQL operation tests for owner isolation, changed wallets/dates/amounts, exact balance effects, rollback/history atomicity, and late retries after edit/deletion. Add focused browser edit/delete coverage.
- [x] Run relevant tests and existing repository checks.

## Scope and handoff

Transfer corrections are delivered in 05; linked-refund and refunded-expense guards in 07. Opening balance corrections belong to 06. Covers spec criteria 1–3, 9–11, 14, 23–25 for income/expenses.

## Comments

2026-09-13 — Implemented on `main`.

- Routes: `/transactions/[id]/edit` renders the same `TransactionForm` in an
  edit mode (fixed type label with the delete/recreate explanation, values
  loaded exactly, no autofocus, Cancel/Esc back to detail, a "Recorded …
  Bangkok time" footer, and "Delete expense/income" as the one destructive
  control below Save). Detail gained an Edit link; the list shows a
  "Transaction deleted." notice at `?deleted=1`. Edit success returns to
  `?saved=<id>` with the row highlighted, like a create.
- Schema (`db:push`): `transaction_changes` (per-owner internal history:
  `edit`/`delete`, `before`/`after` jsonb snapshots, `changed_at` stamped with
  `clock_timestamp()` so edits that waited on the row lock sort after the
  one they waited for). Snapshots carry type/wallet/category/amount/date/
  note; transfer and refund corrections can extend the shape without a new
  table.
- Operations: `updateTransaction` locks the current row (`FOR UPDATE`),
  re-validates wallet/category/date/amount/note against the owner's records
  inside the committing transaction (the stored type decides the category
  tree), updates, and writes the history row in the same transaction; an
  edit that changes nothing succeeds without history. `deleteTransaction`
  soft-deletes with a `delete` history row; repeating it is the same
  outcome. `listTransactionChanges` reads the history (tests only; never in
  normal views). Recording time is never touched.
- Receipts: unchanged and sufficient. A create replay reads the receipt's
  record as it now stands, so a late retry after an edit confirms the edited
  values and after a deletion confirms the original id without recreating
  anything.
- Actions: `updateTransactionAction` (drops any `type` in the payload) and
  `deleteTransactionAction`, sharing the create action's rejection mapping
  plus a `not-found` outcome. The form hook now takes `initialValues` and a
  `save` function; the lost-response replay flow applies to edits too
  (harmless, since an identical re-save is a no-op).
- Tests: 7 PostgreSQL operation tests (replaced effects across two wallets
  and dates with exact balances and history; no-op edit; six rejected edits
  incl. the new wallet's opening date, with no partial effect or history;
  owner isolation for edit/delete/history; deletion out of list/detail/
  balances/history with idempotent repeat and no edit afterwards; late
  create retries after edit and delete; five concurrent edits serialized).
  1 unit test for `formatMoneyInput`. 2 browser tests × phone/desktop (load,
  fixed type, Esc, edit and balance; invalid edit keeps values and names the
  field, delete with confirmation and notice).
- Design: extension of the incumbent world; surface brief updated in
  `.impeccable/surfaces/src-app-app-transactions-new-page-tsx.md`; DESIGN.md
  unchanged; inspected at 360px, 412px, 1280px.
- Verification: 86 unit/database tests, 26 browser tests, Biome, Prettier,
  markdownlint, type check, and production build all passed.

### 2026-09-13 — Deletion navigation and browser error checks

Local CI exposed a development profiler exception after deletion:
`Performance.measure` rejected a negative timestamp for `Page`. The full
browser sequence reproduced it; a focused response check confirmed that the
Server Action revalidated the open edit page after its record was removed,
returning `NEXT_HTTP_ERROR_FALLBACK;404` before client navigation.
The bundled React Server Components profiler has the missing timing guard
reported in [React issue 37561](https://github.com/react/react/issues/37561).

Successful deletion now redirects to the transaction list from the Server
Action after revalidation. The client uses Next's `unstable_rethrow` to preserve
framework redirects while continuing to handle uncertain connection failures.
The existing deletion browser test requires a redirect to the list in the
action response rather than a render of the missing edit page, and
all browser suites check errors across the entire test with
`page.pageErrors({ filter: "all" })`, including before later navigation.

Local `pnpm run ci` now runs browser tests against its production build using
`CI=1`, matching GitHub Actions. Standalone browser tests retain development
mode. This avoids the unnecessary deleted-page render; other development
redirect/not-found paths may still encounter the upstream profiler bug until
Next.js incorporates its fix.

Verification: a clean `pnpm run ci` passed all checks, 86 unit/integration
tests, and 26 production browser tests without retries. The original
development desktop sequence also passed all 13 tests without the profiler
exception.
