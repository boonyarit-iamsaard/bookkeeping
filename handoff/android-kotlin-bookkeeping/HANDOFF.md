# Handoff: Android/Kotlin Bookkeeping Rewrite

Prepared on 2026-09-18 for a fresh session in a new repository.

## Next session objective

Create the documentation foundation for a fresh Android-only replacement of the
Bookkeeping personal-finance project. The new project will use Kotlin, Jetpack
Compose, and Room over an on-device SQLite database. It starts fresh: do not port
the existing application architecture, UI design, authentication, server, or data.

The immediate job in the new repository is not implementation. It is to:

1. establish the repository and Matt Pocock skill conventions;
2. settle the new Android architecture and UI direction through grilling;
3. rewrite the product, domain, tracking, acceptance, and ADR documents described
   below;
4. turn the resulting specification into dependency-aware tickets.

## Why this rewrite exists

This is a personal project with one user: its author. The rewrite is intentionally
not justified by delivery efficiency. Its purpose is to restore joy and motivation
by learning Kotlin, native Android development, Jetpack Compose, Room, and SQLite
through hands-on work.

The author normally uses an agentic full implementation loop. This project changes
that loop so the author writes all production code and tests by hand. Agents may
help shape specifications, tickets, tutorials, and reviews, but must not implement
or silently repair the application.

## Confirmed project direction

- Product name: **Bookkeeping**.
- Platform for this rewrite: **Android only**.
- Language and UI: **Kotlin with Jetpack Compose**.
- Persistence for milestone one: **Room over local SQLite**.
- Authority model: the database on the device is the sole authority.
- User model: one local user; no application account or login.
- Security for milestone one: rely on Android device security. An app-specific
  biometric or PIN gate is not required.
- Connectivity: the tracking milestone must work without a server or network.
- Existing data: do not migrate or import it. The new ledger starts empty.
- Replacement intent: the Android app will replace the existing project for the
  author's actual bookkeeping once the tracking milestone and database-readiness
  criteria are satisfied.
- Future direction: a Kotlin/Spring Boot server may be explored later, but it must
  not influence milestone-one architecture. Do not add sync, networking, outboxes,
  tombstones, merge policies, remote identity, or abstractions for that possibility.
- The term **device-owned offline app** is more accurate for milestone one than a
  sync-capable interpretation of “local-first.”

## Product purpose

Bookkeeping is a personal-finance ledger for recording household money movements
soon after they occur, understanding where money is held and spent, reviewing
monthly results, and correcting mistakes without silently losing their history.

The first milestone is **tracking**. Its functionality is already settled by the
completed tracking milestone in the existing repository. The new project may
redesign the interface and choose a new Android architecture, but it must not
reopen the milestone's product behavior during the rewrite.

Core principles:

1. **Capture beats completeness.** Fast entry with sensible defaults and
   Uncategorized is better than abandoned entry.
2. **The ledger is honest.** Corrections replace current financial effects while
   retaining internal correction history; refunds remain linked to expenses.
3. **Money is exact.** Use integer minor units, explicit THB, Bangkok calendar
   dates, and deterministic as-of-date balances.
4. **Domain vocabulary is UI vocabulary.** In particular, use “wallet,” not
   “account,” for a money holding.
5. **The project teaches through construction.** The author must understand and
   write the code and tests rather than transcribe an agent-generated solution.

## Canonical domain language

Use these terms in specifications, tickets, tests, and UI copy:

- **Wallet**: a money holding owned by the user, with a type of cash, bank account,
  or e-wallet. Avoid “account” as the collective name for holdings.
- **Opening balance**: the amount held in a wallet on the date its tracked history
  begins.
- **Transaction date**: the calendar date a money movement occurred; it determines
  balance and reporting effects.
- **Recording time**: the instant a transaction was originally entered, distinct
  from its transaction date.
- **Income**: money received from an external source.
- **Expense**: money spent on an external recipient.
- **Refund**: money returned for an expense; it reduces expenses and increases the
  receiving wallet.
- **Transfer**: movement of money between two wallets owned by the user.
- **Source wallet**: the wallet from which a transfer removes money; shown as From.
- **Destination wallet**: the wallet to which a transfer adds money; shown as To.
- **Parent category**: the first level of an income or expense category tree; it is
  selectable and may group children.
- **Child category**: the second and final category level; it belongs to one parent
  and is also selectable.
- **Uncategorized**: a protected parent in each income and expense tree. It is the
  default and removal fallback, cannot be removed or renamed, and has no children.
- **Minor unit**: the smallest monetary unit used to record an amount; for THB,
  one satang.

## Tracking milestone behavior to preserve

The fresh specification must restate these rules without referring to web, HTTP,
PostgreSQL, or the previous implementation.

### Money, dates, and balances

- Currency is THB only. Parse decimal input exactly and store money as integer
  satang in a type large enough for exact aggregates.
- Transaction amounts range from ฿0.01 through ฿99,999,999.99. Reject empty, zero,
  negative, over-limit, extra-decimal, or invalid input without rounding.
- Notes are optional and limited to 200 characters.
- Transaction dates are calendar dates interpreted in Asia/Bangkok. Permit today,
  past dates, and a wallet's opening date; reject future dates and dates before any
  affected wallet opens. A transfer must satisfy both wallet opening dates.
- Preserve the original recording time separately when a transaction is edited.
- An opening balance represents the beginning of its opening date. End-of-day
  balances include all current, nondeleted movements through that date.
- Income and refunds add money; expenses subtract it; transfers subtract from the
  source and add to the destination. Openings and transfers are not income.
- Negative wallet balances are valid.
- Derive balances from dated opening balances and current transactions. Do not
  store a mutable current balance, introduce formal double-entry accounting, or
  build an event-sourced financial projection.
- Editing replaces the old financial effect; deleting removes it from balances,
  reports, and normal history while retaining internal correction history.

### Wallet lifecycle

- Wallet types are cash, bank account, and e-wallet.
- A wallet has a dated opening balance and can be archived or unarchived.
- Archived wallets retain their balances and history and remain included in current
  and historical totals, but cannot be used for new transactions.
- Existing transactions involving an archived wallet remain editable or deletable;
  an edit may retain that wallet but may not newly assign another archived wallet.
- Permanently delete only a wallet with no transaction history. A zero balance is
  not sufficient permission to delete it.
- An opening date cannot be moved past an existing movement.

### Transactions and refunds

- Transaction types are income, expense, transfer, and refund. Type is immutable
  after creation; correcting the type requires deletion and recreation, subject to
  refund constraints.
- Income and expenses use one wallet and a category from their corresponding tree.
- Transfers use distinct source and destination wallets, have no category, and
  update both wallets atomically. Transfer fees are separate expenses.
- Create a refund from an existing expense. The refund remains linked to it,
  inherits its category, and may use a different receiving wallet.
- A refund cannot predate the expense or receiving wallet opening, be future-dated,
  or make the combined nondeleted refunds exceed the expense amount.
- Block deleting an expense while refunds exist and block reducing its amount below
  the refunded total. Date and category changes must keep linked refunds coherent.
- Refunds follow the expense's current category, including category-removal
  fallbacks.
- If an expense's original wallet is archived, refund entry must require an
  explicit active receiving wallet. Do not silently pick another wallet.
- Financial changes and their internal correction history must commit atomically.
  Failed operations leave no partial effect.
- Do not port HTTP idempotency receipts or PostgreSQL concurrency mechanisms.
  Prevent accidental duplicate local submissions through the Android UI and local
  transaction boundary appropriate to the new architecture.

### Categories and icons

- Maintain separate income and expense category trees with exactly two levels.
  Parents and children are both selectable.
- Seed editable default categories and exactly one protected Uncategorized parent
  in each tree. Reinitialization must not duplicate defaults or overwrite edits.
- Trim names, reject blank names, and enforce case-insensitive uniqueness for
  parents within a tree and children within a parent.
- Allow rename and icon changes. Do not allow moving a child to a different parent
  or adding a third level.
- Removing a child reassigns its transactions to its parent.
- Any remaining child blocks parent removal. Removing a childless parent reassigns
  its transactions to that tree's Uncategorized category.
- Uncategorized cannot be removed, renamed, or given children; its icon may change.
- Search across both levels and display child results with their parent context.
- Allow creating a parent or child, including a missing parent, without abandoning
  transaction entry. A saved category is selected immediately and remains saved if
  the transaction is canceled.
- Provide a bundled icon catalog with a guaranteed generic fallback, browsing, and
  manual overrides. Local English-keyword recommendations are deterministic,
  limited to six, and never required to save.
- The exact default category data and Android icon catalog should be deliberately
  authored during the relevant new-project ticket. Preserve the behavior, not the
  old Lucide catalog or stable IDs, because no data is migrating.

### Entry, lists, and reporting

- Optimize for one-handed phone entry immediately after paying.
- Defaults for ordinary creation: Expense, today's Bangkok date, last-used active
  wallet when available, and the matching tree's Uncategorized category. Otherwise
  choose an active wallet deterministically.
- Amount is the leading input. Income and expense then expose wallet, category,
  date, and optional note. Transfer exposes From and To plus swapping and no
  category. Refund clearly shows its linked expense and remaining allowance.
- Without an active wallet, present an actionable create/unarchive state.
- Preserve entered values on validation or unexpected errors. Clearly associate
  errors with fields and announce them accessibly.
- Provide transaction list and detail, wallet management and current/as-of-date
  balances, category management, and monthly summaries.
- Filters cover date, wallet, category, and type. Transfers match either wallet.
  Filtering a parent includes its children. Refunds appear distinctly and link to
  their expense. Deleted transactions stay out of normal lists.
- Monthly boundaries follow Bangkok transaction dates. Report income, gross
  expenses, refunds, net expenses (gross expenses minus refunds), and net (income
  minus net expenses). Count refunds in their own month; exclude transfers and
  opening balances.
- The Android UI and information architecture are a fresh design. Preserve the
  behavior, terminology, financial invariants, validation, accessibility outcomes,
  and practical phone-entry goal—not the previous visual identity or browser flow.

## Accepted architectural decisions to record

### ADR: derive wallet balances

For the tracking milestone, derive wallet balances from dated opening balances and
current transactions. Direct edits replace financial effects and deletion removes
them. Atomic transfers and internal correction history provide consistency and
traceability without formal double-entry accounting or event sourcing.

### ADR: device-owned Room database

Room over SQLite is the sole authority for milestone one. During development,
destructive schema resets are acceptable. Before the author begins using the app as
the real ledger, freeze a Room schema version, export Room schemas, require explicit
migrations, and test migration paths. The future Spring Boot idea creates no
milestone-one requirement.

## Documentation package for the fresh repository

Create new documents rather than copying or editing the old ones:

1. `PRODUCT.md`: purpose, learning intent, Android-only/device-owned context,
   tracking scope, principles, and deferred concerns.
2. `CONTEXT.md`: the canonical glossary above, without implementation details.
3. `docs/tracking-spec.md`: complete framework-neutral tracking behavior,
   invariants, validation, defaults, ordering, and out-of-scope boundaries.
4. `docs/acceptance/tracking-scenarios.md`: concrete scenarios sufficient to
   validate parity without reading the old codebase.
5. `docs/adr/0001-derived-balances.md`: the accepted balance decision.
6. `docs/adr/0002-device-owned-room-database.md`: the accepted local-authority and
   schema-migration decision.
7. `AGENTS.md`: repository guidance added after scaffolding, including the manual
   implementation rule and tutorial workflow.

The accompanying `evidence/` directory is a frozen source bundle, not canonical
documentation for the new project. Move this whole handoff folder into the new
repository, then rewrite the documents above so that the project understands its
own direction and milestone without treating obsolete implementation context as
instructions.

## Manual-learning workflow

The intended loop is:

`grill-with-docs → to-spec → to-tickets → tutorial handoff → author implements code and tests → code-review`

- Use Matt Pocock's `to-spec` and `to-tickets` skills normally.
- A future reusable tutorial skill will replace `implement` in the loop, but
  creating that skill is outside the current session.
- The tutorial should teach the concepts needed for a ticket in the style of a
  course, article, or guided exercise. The author then struggles with and completes
  the implementation by hand.
- The author writes both production code and tests.
- Agents must not write, patch, complete, or silently repair application code.
- Agents may investigate facts, explain concepts, maintain agreed documentation,
  run checks after the author's attempt, and perform code review.
- Clear context between implementation tickets; each ticket must be self-contained.

## Explicitly deferred or excluded

Decide these in the new repository only when their phase arrives:

- Android application architecture, module boundaries, dependency injection, and
  concrete dependency choices other than Kotlin, Compose, and Room;
- the new visual design, navigation, information architecture, and interaction
  details;
- backup, restore, encryption beyond Android's normal app/device protections, and
  device-loss recovery;
- Spring Boot, network APIs, authentication, synchronization, conflict resolution,
  or multiple devices;
- import or migration of the old ledger;
- budgeting and forecasting milestones.

Still out of scope for tracking: scheduled or recurring entries, credit cards,
formal double-entry, bank sync, statement import, third-party financial access,
persistent drafts, attachments, split categories, reconciliation, multiple
currencies, exchange rates, sharing, collaboration, Thai translation, and public
launch planning.

## Bundled previous-project evidence

The `evidence/` directory travels with this handoff and is evidence only. Do not
transfer its architecture or design into the new canonical documents. If an
ambiguity is discovered while rewriting them, consult these bundled primary
sources and translate only product/domain truth:

- [`evidence/tracking/spec.md`](evidence/tracking/spec.md)
- [`evidence/tracking/milestone-verification.md`](evidence/tracking/milestone-verification.md)
- [`evidence/tracking/issues/`](evidence/tracking/issues/)
- [`evidence/tracking/design-brief-transaction-form.md`](evidence/tracking/design-brief-transaction-form.md)
- [`evidence/tracking/technical-design.md`](evidence/tracking/technical-design.md)
- [`evidence/CONTEXT.md`](evidence/CONTEXT.md)
- [`evidence/adr/0001-transaction-derived-balances.md`](evidence/adr/0001-transaction-derived-balances.md)
- [`evidence/PRODUCT.md`](evidence/PRODUCT.md)

When those sources contain Next.js, browser, HTTP, authentication, Hono,
PostgreSQL, Drizzle, TypeScript, monorepo, or old visual-system decisions, leave
those details behind. The completed tracking behavior is the parity authority; the
Hono migration is not.

## Recommended next actions

1. Scaffold a fresh Android Studio project using Kotlin and Jetpack Compose.
2. Initialize its Git repository.
3. Move or copy this entire handoff folder into that repository.
4. Run `setup-matt-pocock-skills` there.
5. Start a fresh session against `HANDOFF.md`; keep `evidence/` available as its
   portable primary-source bundle.
6. Use `grill-with-docs` to settle the Android architecture and initial UI direction.
7. Use `to-spec`, then `to-tickets` in the same unbroken context when possible.
8. Work each ticket manually through the tutorial workflow and finish with review.

Do not use `wayfinder` unless the new architecture or redesign proves too foggy to
settle in an ordinary grilling session. Use a prototype only when a runnable state,
business rule, or visible UI is genuinely needed to answer a specific decision.

## Suggested skills

In the next repository, ask the Skill tool for:

- **`setup-matt-pocock-skills`** first, to establish the expected issue-tracker and
  documentation conventions.
- **`grill-with-docs`** to decide the deferred Android architecture and UI direction
  while recording glossary and ADR decisions.
- **`domain-modeling`** underneath that work when terminology or financial
  invariants need sharpening.
- **`to-spec`** to turn the handoff and resolved decisions into the canonical fresh
  documentation package.
- **`to-tickets`** to divide the accepted spec into dependency-aware, self-contained
  tracer-bullet tickets.
- **`writing-for-agents`** when creating the new repository's `AGENTS.md` or the
  future tutorial skill.
- **`code-review`** after the author completes each ticket manually.
- **`research`** only for current Android/Kotlin/Compose/Room facts that require
  official primary sources.
- **`prototype`** only for a narrowly framed question that cannot be settled in
  conversation.
