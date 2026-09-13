# 02: Record income and expenses reliably

**What to build:** Record income or an expense from a full-screen form, see the saved transaction in a basic list/detail view, and see its effect on wallet balances. Quick expense entry is amount followed by Save, with reliable handling of duplicate taps and lost responses.

**Blocked by:** 01: Create wallets with dated opening balances.

**Status:** done

## Acceptance criteria

- [x] Support income and expense creation with wallet, amount, date, matching-tree category, and optional note. Creation can switch these two types; saved records retain their type.
- [x] Initialize each user's editable copies of default income/expense category trees, including exactly one protected Uncategorized parent per tree. Repeat initialization without duplicates or overwriting customization; confirm exact default contents during this ticket.
- [x] Both parent and child defaults are selectable. Categories belong to the owner and correct income/expense tree; the generic icon is valid without a recommendation dependency.
- [x] Default to Expense, today in Asia/Bangkok, last-used active wallet, and matching Uncategorized. Without a last-used active wallet use deterministic active-wallet ordering; without an available wallet show a creation action rather than a disabled form.
- [x] Accept ฿0.01–฿99,999,999.99 exactly as integer satang. Reject empty, invalid, zero, negative, over-limit, and extra-decimal input without rounding. Notes allow at most 200 characters.
- [x] Date-only entry permits backdating and the wallet's opening day, rejects future/pre-opening dates, and offers Today/Yesterday shortcuts subject to the same rules. Bangkok midnight determines today independently of browser/server locale.
- [x] Income adds and expenses subtract from derived balances; allow negative results. Backdated entries affect the correct dates. Openings do not become income.
- [x] Persist an original server recording timestamp, display it separately with Bangkok hours/minutes, and exclude recording order from financial calculations.
- [x] Bind each logical create key to owner, operation, and canonical validated payload; commit the receipt and transaction together. Same key/payload, including simultaneous requests, saves once; changed payload conflicts; distinct keys permit intentional identical records.
- [x] Disable Save in flight. On uncertain outcome retain the original snapshot/key, explain the check, and replay it before allowing changed submissions. Confirmed success opens the saved result; definitive no-commit rejection permits correction with a new key. A network error is not definitive rejection.
- [x] Save reads back amount/wallet, success returns to the basic list with the saved row highlighted, and detail exposes the fields and recording time. Do not rely on a future filtered-list ticket for a usable success destination.
- [x] Match the confirmed transaction-form brief: amount leads with native decimal keyboard and requested focus, wallet/category/date/note rows, 360px phone support, safe-area-aware reachable Save, desktop Enter/Esc, and no custom keypad.
- [x] Use stable loading states, values retained on validation/server error, field-associated announced errors, labeled controls, reduced-motion support, minimum 44px touch targets, and minimum 48px phone Save. Apply impeccable and verify phone/desktop behavior.
- [x] Prove ownership, exact amounts, Bangkok dates, derived balances, receipt atomicity, concurrent duplicates, and changed-payload conflicts through real PostgreSQL operation tests. Browser coverage includes quick entry and a committed transaction with a lost response resolved without duplication.
- [x] Run relevant tests and existing repository checks. Financial validation occurs on the server, not only in the form.

## Scope and handoff

Custom in-screen categories follow in 03, corrections in 04, transfers in 05, and refunds in 07. Do not expose nonworking Transfer/Refund controls as if supported. Covers spec criteria 1–3, 9–13, 15–16, 24–25 for this ticket's types.

## Comments

2026-09-13 — Implemented on `main`.

- Routes: `/transactions` (basic list, newest transaction date first, saved
  row highlighted via `?saved=<id>`), `/transactions/new` (full-screen form),
  `/transactions/[id]` (detail with "Recorded … Bangkok time"). Header gained
  a Transactions link.
- Schema (`db:push`): `categories` (per-user two-level trees, partial unique
  indexes for one protected Uncategorized per tree and case-insensitive names
  per scope), `transactions` (integer satang `bigint`, range and note-length
  checks, `recorded_at`, `deleted_at` for ticket 04, restrict FKs so wallet
  deletion can never cascade history), `submission_receipts` (unique on
  owner + operation + key, SHA-256 payload fingerprint, committed with the
  transaction).
- Default categories confirmed with the user (full Thai-household set) in
  `src/features/categories/defaults.ts`; icon catalog with a guaranteed
  generic id in `src/features/categories/icons.ts`. Initialization takes a
  per-owner advisory lock and seeds a tree only while it has no protected
  Uncategorized, so repeats neither duplicate nor overwrite.
- Idempotency: `createTransaction` inserts the record then the receipt
  (`ON CONFLICT DO NOTHING`); a concurrent duplicate blocks on the unique
  index, loses, rolls its own insert back, and replays the winner. Same key +
  different fingerprint → `submission-conflict`. A definitive rejection
  leaves no receipt. The form mints one key per submission, replays the exact
  snapshot after a thrown/network error with fields locked, and mints a new
  key after any server answer.
- Balances: `listWallets` now derives end-of-day balances from opening plus
  income minus expenses through `asOf` (default today in Bangkok), ignoring
  soft-deleted rows and recording time.
- Last-used wallet is derived from the most recently recorded transaction;
  without one, the first wallet in picker order. No archive yet (06), so all
  wallets count as active.
- Tests: 13 PostgreSQL operation tests for transactions (exact bounds,
  Bangkok midnight, opening day, kind mismatch, cross-user not-found,
  recording time, replay, changed-payload conflict, 5-way concurrent
  duplicate), 3 for categories; 11 unit tests for the form schema and date
  helpers; 4 browser tests × phone/desktop including a committed save whose
  response is dropped and replayed without a duplicate.
- Design: extension of the incumbent world; surface brief at
  `.impeccable/surfaces/src-app-app-transactions-new-page-tsx.md`; DESIGN.md
  unchanged. Wallet and category pickers are native selects (fast, keyboard-
  complete, phone-native); the searchable category panel arrives with 03.
- Verification: 57 unit/database tests, 16 browser tests, Biome, Prettier,
  markdownlint, type check, and production build all passed.

2026-09-13 — Addressed the commit review.

- Spec axis: `lastUsedWalletId` now ignores soft-deleted rows like every other
  query; a receipt replay reads its record even once deleted (ticket 04), so a
  late retry confirms the original outcome instead of throwing.
- Standards axis: list rows dropped their hover fill and radius, the detail
  pictogram disc and row height match the system, the selected date chip no
  longer adds a second cobalt fill, `formatBangkokInstant` uses
  `hourCycle: "h23"`, and small duplications were folded (`FieldErrors`,
  `categoryLabel`, derived `TransactionFormField`). The larger amount input is
  kept on purpose per the confirmed form brief and noted in the surface brief.
- Glossary gap for `/domain-modeling`: "submission key" and "submission
  receipt" are used in code but absent from `CONTEXT.md`.
- Known UX gap, not a correctness hole: the form's `today` is computed at
  render, so `max` and the Today/Yesterday chips go stale if the form stays
  open across Bangkok midnight; the schema and server re-check live.

2026-09-13 — Addressed the cohesion and predictability review.

- Grouped transaction lookup/replay, category seeding, and wallet-list inputs
  into named options; updated every caller and existing database tests.
- Extracted shared signed-money rendering from the transaction list into its
  own component, used by both list and detail.
- Linked inline errors to their controls with stable IDs and accessible
  descriptions, and included wallet type alongside name and balance.
- Resolved the Bangkok-midnight UX gap noted above: shortcut dates and the
  date maximum refresh at midnight and when the page resumes, without
  overwriting a selected date or pending submission. Added browser regression
  coverage for midnight, error associations, and wallet labels.
