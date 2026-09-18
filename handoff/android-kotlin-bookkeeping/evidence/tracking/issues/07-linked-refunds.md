# 07: Record and correct linked refunds

**What to build:** Record full or partial refunds from an expense's detail, choose where money arrives, and correct refunds while protecting the original expense and its remaining refundable amount.

**Blocked by:** 06: Manage wallet lifecycle and opening corrections.

**Status:** done

## Acceptance criteria

- [x] Start refund entry from an existing owned expense, never the general creation type picker. Lock type/link, show expense category/date/amount/remaining allowance, and inherit category read-only.
- [x] Prefill the remaining refundable amount and original wallet only if active. For an archived original wallet leave receiving wallet unselected and require an explicit active choice or unarchive; never silently substitute another wallet.
- [x] Without active receiving wallets, show create/unarchive actions and prevent submission. Allow a receiving wallet different from the original expense's wallet.
- [x] Amounts follow positive exact-satang limits; combined nondeleted refunds cannot exceed the expense. Dates cannot precede the expense or receiving opening, or exceed Bangkok today.
- [x] Creation reuses idempotency/snapshot retry handling. Refunds increase the receiving balance and reduce expenses; they are not income or changes to the original expense amount.
- [x] Show refund as a distinct list/detail type linked to its expense. Permit valid edit/delete with original recording time preserved and atomic internal history; refund edits exclude their own old amount from the allowance calculation.
- [x] Block expense deletion while refunds exist, reductions below refunded totals, and date edits that invalidate refund ordering. Explain remaining allowance and list linked refunds when they block deletion.
- [x] Refunds always use the expense's current category, including subsequent category removal fallbacks. Do not permit independent refund categorization.
- [x] Concurrent refunds cannot exceed the expense. Serialize refund creates/edits/deletes against expense corrections/deletion and receiving-wallet archive so committed records always obey constraints.
- [x] Existing refunds on archived wallets remain editable according to retained-wallet rules; changing to another archived wallet is rejected.
- [x] Apply impeccable to the confirmed refund chip, locked fields, actionable wallet fallback, validation, and keyboard/phone/desktop behavior.
- [x] PostgreSQL tests prove partial/full limits, competing refunds, date rules, different wallets, expense guards, rollback/history, owner isolation, and duplicate saves. Browser coverage includes linked entry, archived-original fallback, and blocked expense correction.
- [x] Run relevant tests and existing repository checks.

## Scope and handoff

Category management verifies refund fallbacks in 08; monthly own-date refund reporting follows in 09. Covers spec criteria 1–3, 5–6, 8, 10–14, 20, 23–25 for refund behavior.

## Comments

2026-09-14 — Implemented on `main`.

- Schema (`db:push`): `transaction_type` gains `refund`; `transactions`
  gains `refund_of_transaction_id` (restrict) and the shape check now
  admits refunds with no category and no destination. A refund's category
  is never stored: detail and list queries read it from the expense, so
  category changes and 08's removal fallbacks follow at once.
- Operations: `createTransaction` accepts `type: "refund"` with
  `refundOfTransactionId`, locks the owner's current expense `FOR UPDATE`
  before the wallet share locks (the same lock expense edits and deletions
  take), then checks the date against the expense and the amount against
  the remaining allowance. `updateTransaction` keeps the link fixed,
  excludes the refund's own old amount, and guards an expense against
  amounts below its refunded total or dates past its earliest refund.
  `deleteTransaction` refuses an expense with refunds and returns them.
  `getExpenseRefunds` serves the detail, refund, and edit pages. A raced
  duplicate refund that loses the cap after waiting on the lock is replayed
  from its receipt rather than rejected.
- Routes: `/transactions/[id]/refund` (locked type, linked chip, inherited
  category, "Received in", allowance prefilled, archived-original fallback,
  no-active-wallet block); expense detail gains a Refunds section; refund
  detail has "Refund of"; the list prefixes "Refund ·"; the expense edit
  footer names the refunded total and the blocked deletion lists refunds.
- Tests: 6 PostgreSQL operation tests, 5 schema unit tests, 1 browser
  test × phone/desktop. Full run: 109 unit/integration, 34 production
  browser tests, Biome, Prettier, markdownlint, type check, build.
- Design: extension of the incumbent world; surface brief and
  `.impeccable/review/refund-review.md` updated. One batched round found the
  chip widening the 360px column (fieldset min-content) and truncating the
  allowance; both fixed and confirmed.
- Local development Postgres was not running in this session, so `db:push`
  was applied only to the test containers; run `pnpm db:push` locally.
