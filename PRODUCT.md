# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person: the author, tracking their own household money. There is no
market, no onboarding funnel, and no second audience. The user already knows
the domain vocabulary (see `CONTEXT.md`) and will use the app daily for years.

Separate signed-in users are supported with fully isolated data, but sharing
between users is out of scope; multi-user exists for isolation, not
collaboration.

## Product Purpose

A personal finance app covering tracking, budgeting, and forecasting. The
first milestone is tracking: income, expenses, refunds, and transfers between
user-owned wallets (cash, bank account, e-wallet), with two-level categories
and monthly income/expense/net totals. The milestone ends when the deployed
app can hold the user's real ledger: automated backups stored off the hosting
provider with a proven restore, a schema migration strategy, and the trial
data cleared, per `docs/adr/0008`.

Status (2026-10-01): the user has kept their real ledger in the deployed app
since September 2026, but milestone one is not closed. Off-provider automated
backups, a proven restore, and the first-week usage review
(`.scratch/deployment/issues/05-first-week-usage-review.md`) are still open.

Current focus is a redesign that replaces the whole visual world. Product
truth, flows, and domain vocabulary carry over. The trigger is that the
previous look no longer fits the user; no usability failure was reported. A
milestone after tracking (budgeting or forecasting) has not been chosen.

Success is a ledger the user trusts enough to keep: every transaction captured
close to the moment of spend, balances that reconcile with reality, and
corrections that leave an honest history.

## Positioning

Built because the user tried many finance apps and none fully fit what they
need (user's words; no further differentiation claim was confirmed). The
confirmed spec does encode where those apps fell short for this user:

- Wallets as the single holding concept, not "accounts".
- Refunds as a first-class transaction type linked to the original expense,
  reducing expenses rather than posing as income.
- Categories that can be created without leaving the transaction form.
- Amounts stored as integer satang; Bangkok-time dates; a distinct recording
  timestamp separate from the transaction date.
- Manual entry only; no bank sync, no third-party access to the data.

## Operating Context

- **Primary capture scene:** on the phone, right after paying. Speed of entry
  and one-handed use dominate; the form should default to today, the last
  wallet, and Uncategorized so a transaction can be saved in seconds.
- **Secondary scenes:** reviewing the transaction list with filters, checking
  wallet balances (current and as-of-date), reading monthly totals, and
  managing wallets and categories. These happen on phone or desktop.
- **Connectivity:** mobile networks; duplicate taps and retries are expected
  and must not create duplicate transactions (idempotency key per create).
- **Locale:** Thailand. Currency is THB only; dates and times display in
  Bangkok time; the interface is English-only for the first milestone.
- **Devices and browsers:** installed as a PWA and used in Chrome or Edge on
  Android and on desktop. Chromium is the only supported engine
  (`docs/adr/0007`); revisit if the app is used on iPhone, iPad, or Safari.
- **Origin workflow:** before the app, the user tracked money in a
  spreadsheet of cash movements in and out of cash and bank holdings,
  including borrowing and debt repayment. The app preserves that model.

## Capabilities and Constraints

Confirmed product facts live in `.scratch/tracking/spec.md` (direction
confirmed 2026-09-12) and `docs/adr/0001-transaction-derived-balances.md`;
domain vocabulary lives in `CONTEXT.md`. Summary:

- Transaction types: income, expense, refund, transfer. Type is fixed after
  creation. Transfers have no category and are excluded from income/expense
  totals; same-wallet transfers are prohibited; fees are separate expenses.
- Refunds link to an existing expense, cannot exceed it in total, follow its
  category, and may land in a different wallet.
- Categories: exactly two levels, separate income and expense trees, per-user
  copies of defaults, a protected Uncategorized parent in each tree. Names
  unique case- and whitespace-insensitively within scope. Each category has an
  icon chosen from a shipped catalog with local keyword recommendations.
- Wallets: dated opening balance, negative balances allowed, archive and
  unarchive, permanent delete only when empty. Balances are derived from
  opening balance plus transactions (no double-entry).
- Transaction date is date-only, defaults to today (Bangkok), cannot be in
  the future or before the wallet's opening date. Recording time is shown
  separately and is informational.
- Amounts: positive, at most two decimals, stored as integer satang with an
  explicit THB currency.
- Direct edit and delete of transactions, with an internal change history
  that is not part of the user's normal view.
- Layouts must work on phone and desktop; the phone is the primary device.
- Debt as cash movements (`docs/adr/0011`): a debt payment is one
  Expense from the paying wallet on the payment date, covering principal,
  interest, and fees, under a "Debt payments" parent category with a child
  per card or debt (e.g. a mortgage). A card cash advance is Income into the
  receiving cash or bank-account wallet when the money arrives. Card and
  loan balances, and purchases charged to a card, are not tracked. As a
  result, Income totals include borrowed money.

Out of scope for milestone one: credit cards as tracked balances or card
purchases, statement import, bank sync,
recurring transactions, attachments, split categories, reconciliation,
multi-currency, sharing, Thai translation, export/import.

Stack: Hono on Node.js as the sole backend (`docs/adr/0003`), a Vite +
TanStack Router single-page web client installable as a PWA, which replaced
the Next.js app (`docs/adr/0006`), React, TypeScript, PostgreSQL with Drizzle,
Better Auth (email/password), Tailwind CSS v4, shadcn with Base UI, and Lucide
icons. Fonts and other visual choices belong to `DESIGN.md`. React Native and
native wrappers are not planned.

## Brand Commitments

- Name: **Bookkeeping** (final).
- No logo, voice guidelines, or other identity assets exist.
- Domain terminology in `CONTEXT.md` is binding in UI copy: "wallet", not
  "account", for money holdings; "Uncategorized" as the fallback category
  name.
- Visual direction (standing preference, restated 2026-10-01): clean modern
  fintech, played straight at full craft. Concretely, the user confirmed four
  moves away from the 2026-09 "statement" rendition: cards and surfaces,
  sans-serif money figures, dark mode alongside light, and category color
  with charts. Benchmark whose craft level sets the bar: MAKE by KBank and
  K PLUS. The goal is to sit beside them, not imitate them; no bank brand
  colors, marks, or layouts are borrowed. The incumbent look in `DESIGN.md`
  is evidence of what is being replaced, not a constraint.

## Evidence on Hand

- Confirmed product spec: `.scratch/tracking/spec.md`.
- Architecture decision: `docs/adr/0001-transaction-derived-balances.md`.
- Implementation notes for the icon catalog:
  `.scratch/tracking/technical-design.md`.
- Domain glossary: `CONTEXT.md`.
- Debt decision: `docs/adr/0011-debt-cash-movements.md`.
- Real data exists only in the production database on Railway. It is the
  user's actual finances and must never be copied into design work,
  screenshots, or fixtures. No testimonials or usage metrics exist. Sample
  data in the UI must be clearly placeholder; do not fabricate financial
  figures as if they were the user's.

## Product Principles

1. **Capture beats completeness.** A transaction saved in seconds with
   Uncategorized is worth more than a perfect one abandoned at checkout.
   Every required field must have a sensible default.
2. **The ledger is honest.** Corrections never rewrite history silently:
   edits and deletions keep an internal change history, refunds stay linked
   to their expense, and recording time is never confused with transaction
   date.
3. **Money is exact.** Satang integers, explicit currency, Bangkok-time
   dates, and as-of-date balances; no floating-point display artifacts, no
   ambiguous rounding.
4. **The domain vocabulary is the interface vocabulary.** Wallets,
   parent/child categories, refunds, and transfers appear under those names
   and behave as `CONTEXT.md` defines them.
5. **Built for one, correct for many.** Personal use sets the priorities, but
   per-user isolation and idempotency are non-negotiable correctness
   constraints rather than features to defer.

## Accessibility & Inclusion

No formal standard was set. Practical requirements from the capture scene:
comfortable thumb-reach targets on phone, legible numerals, and forms that
work with the on-screen numeric keyboard.
