# Personal finance: tracking milestone

Status: ready-for-agent

Product direction and transaction-form brief confirmed on 2026-09-12.
This specification consolidates those decisions for implementation planning.
The testing seams were confirmed by the user on 2026-09-12; ready for ticketing.

## Problem Statement

The user needs to record household money movements shortly after they happen,
understand where money is held and spent, and correct mistakes without losing an
honest internal history. Existing finance apps have not fully met their needs,
particularly when a needed category must be created during transaction entry.
Leaving the create/edit screen to manage categories interrupts capture.

## Solution

Deliver Bookkeeping's first milestone: manual tracking of income, expenses,
refunds, and transfers between cash, bank account, and e-wallet wallets. Provide
exact THB amounts, dated balances, two-level income/expense categories, category
creation within the transaction screen with local icon recommendations, filters,
and monthly summaries. Optimize entry for a phone immediately after paying while
supporting desktop review and corrections. Separate signed-in users have fully
isolated data; sharing is outside scope.

## User Stories

1. As a user, I want my tracking data isolated, so that other users cannot access or change my finances.
2. As a user, I want cash, bank account, and e-wallet wallets, so that each holding has its own history and balance.
3. As a user, I want dated opening balances, so that tracking begins from known amounts.
4. As a user, I want to correct opening balances, so that initial mistakes do not distort later balances.
5. As a user, I want current and historical wallet balances, so that I understand my holdings over time.
6. As a user, I want negative balances allowed, so that delayed entry does not prevent recording real movements.
7. As a user, I want archive and unarchive controls, so that unused wallets leave entry pickers without losing history.
8. As a user, I want archived holdings included in totals, so that archiving does not make money disappear.
9. As a user, I want wallet deletion guarded by transaction history, so that records are not orphaned.
10. As a user, I want to record income, so that received money increases the selected wallet's balance.
11. As a user, I want to record expenses, so that spending decreases the selected wallet's balance.
12. As a user, I want one transfer updating both wallets, so that money cannot disappear between them.
13. As a user, I want transfer fees recorded separately, so that fees count as expenses while transfers do not.
14. As a user, I want sensible entry defaults, so that the normal path is amount followed by Save.
15. As a user, I want exact satang storage and two-decimal THB displays, so that amounts are never rounded incorrectly.
16. As a user, I want backdated entry, so that forgotten movements can be recorded later.
17. As a user, I want invalid financial dates rejected, so that entries remain inside the wallet's tracked history and do not represent future plans.
18. As a user, I want optional notes, so that context can be recorded without slowing every entry.
19. As a user, I want edits except for transaction type, so that mistakes can be corrected directly.
20. As a user, I want deletion of mistaken transactions, so that they stop affecting normal history and balances.
21. As a user, I want internal correction history, so that changes remain traceable without cluttering normal views.
22. As a user, I want transaction date and recording time shown separately, so that backdated entry is unambiguous.
23. As a user, I want duplicate taps and retries to save once, so that unreliable connections do not duplicate movements.
24. As a user, I want uncertain saves resolved before changing their submission, so that I do not accidentally create another transaction.
25. As a user, I want my own copies of default categories, so that customization does not affect other users.
26. As a user, I want separate two-level income and expense trees, so that categorization stays understandable.
27. As a user, I want either category level selectable, so that I can track broadly or precisely.
28. As a user, I want Uncategorized by default, so that missing categorization never blocks capture.
29. As a user, I want category search across both levels, so that I can find categories without remembering their location.
30. As a user, I want category creation within transaction create/edit, so that I can finish recording without leaving the screen.
31. As a user, I want to create a missing parent while creating a child, so that a missing hierarchy does not interrupt entry.
32. As a user, I want saved categories selected immediately and retained after canceling the transaction, so that their creation is independent.
33. As a user, I want English keyword icon recommendations, so that choosing a pictogram is quick.
34. As a user, I want icon browsing and manual overrides, so that I can choose a recognizable icon.
35. As a user, I want a generic icon when recommendations fail, so that saving remains available.
36. As a user, I want category renaming and icon changes, so that organization can evolve without replacing transactions.
37. As a user, I want removed children to fall back to their parent, so that transactions keep a valid category.
38. As a user, I want parent removal blocked while children exist, so that no child is orphaned.
39. As a user, I want removed parents to fall back to protected Uncategorized, so that their transactions stay valid.
40. As a user, I want linked full and partial refunds, so that returned money reduces expenses rather than inflating income.
41. As a user, I want a different receiving wallet for refunds, so that tracking matches where money arrives.
42. As a user, I want refund limits and expense correction guards, so that linked records cannot contradict each other.
43. As a user, I want refunds to follow the expense category, so that reports stay coherent after category changes.
44. As a user, I want date, wallet, category, and type filters, so that I can investigate specific movements.
45. As a user, I want refunds displayed distinctly and linked to their expense, so that I understand their origin.
46. As a user, I want monthly income, gross expenses, refunds, net expenses, and net totals, so that transfers and refunds are counted correctly.
47. As a user, I want one-handed phone entry with the native decimal keyboard, so that capture is practical after paying.
48. As a user, I want keyboard-complete desktop forms and accessible errors, so that entry works without touch.
49. As a user, I want stable loading and error states with values retained, so that interruptions do not erase my work.
50. As a user, I want an actionable empty state without available wallets, so that I know how to begin tracking.

## Implementation Decisions

### Foundation and operation boundaries

- Reuse the existing Next.js App Router, React, TypeScript, PostgreSQL/Drizzle,
  Better Auth email/password, Tailwind v4, shadcn on Base UI, TanStack Form, Zod,
  Lucide, Inter, and JetBrains Mono foundation.
- Add tracking operations for wallets, categories, transactions/refunds, and
  balance/report queries. Reuse existing database and session boundaries rather
  than introducing competing authentication or database layers.
- Authenticate and authorize every server read/mutation. Derive ownership from
  the session rather than client-submitted user IDs. All linked resources must
  belong to that owner; authenticated layouts alone are insufficient.
- Persist wallet openings/archive state, owned category trees/icon IDs,
  transactions/refund links, internal change history, and submission receipts.
  Enforce durable ownership, referential integrity, and scoped uniqueness.
- Operations accept validated inputs and return explicit validation/conflict
  outcomes. Transport and internal placement may be selected during implementation
  without changing the observable contracts below.

### Money, dates, and balances

- Currency is explicit and restricted to THB. Store integer satang; parse decimal
  input exactly rather than rounding floating-point multiplication. Storage and
  aggregation must accommodate values above signed 32-bit integers and exact totals.
- Transaction amounts are ฿0.01–฿99,999,999.99 inclusive. Reject empty, zero,
  negative, invalid, over-limit, or extra-decimal input without rounding. Display
  currency and two decimals with tabular numerals. Optional notes allow 200 characters.
- Dates are calendar dates. Today and displayed times use Asia/Bangkok. Allow past
  and opening-day transactions; reject future dates and dates before any affected
  wallet opens. Transfers satisfy both wallets' opening dates.
- Recording time is a server-recorded instant, shown separately with hours/minutes
  in Bangkok time. Edits preserve the original timestamp and record changes
  separately. Recording order has no financial effect.
- An opening balance represents the start of its opening date. End-of-day balances
  include its opening plus current, nondeleted movements through the selected date:
  income/refunds add, expenses subtract, transfers subtract from source and add to
  destination. A wallet not yet opened contributes nothing to historical totals;
  its opening balance is not income.
- Derive balances from openings and current transactions, following the ADR. Edits
  replace financial effects and deletion removes them. Formal double-entry and
  event-sourced financial projections are not required.
- Negative balances are valid. Opening corrections keep internal history; changing
  an opening date must not exclude existing movements.

### Wallet lifecycle

- Wallet types are cash, bank account, and e-wallet; each belongs to one user and
  uses THB. Pickers show name, type, and current balance.
- Archive at any balance, retain history, show remaining balances in management,
  and include archived holdings in current and historical overall totals.
- Prohibit new entries involving archived wallets, including transfers/refunds.
  Existing entries remain editable/deletable and show an Archived label. An edit
  may retain its existing archived wallet but cannot assign another archived wallet.
  Allow unarchiving.
- Permanently delete only wallets without transactions. A zero balance does not
  mean no history. Retained transaction/change records must not be erased by wallet
  deletion cascades.

### Transactions, refunds, and consistency

- Types are income, expense, transfer, refund; type is immutable after saving.
  Correct a wrong type through deletion/recreation, subject to refund guards.
- Income/expense have one wallet and a category from the corresponding tree.
  Transfers have distinct source/destination wallets, no category, and one amount.
  Create/edit/delete transfers atomically; fees are separate expenses.
- Create refunds from an owned expense's detail, pre-linked and type locked.
  Prefill remaining refundable amount and inherit category read-only. A refund can
  land in a different wallet.
- Refund dates cannot precede the expense or receiving wallet's opening date or be
  future dates. Combined nondeleted refunds cannot exceed the expense. A refund edit
  excludes its own old amount when checking the remaining allowance.
- Block expense deletion while refunds exist and reductions below the refunded
  total. Expense/refund date edits preserve all linked date rules. Refunds always
  follow the expense's current category, including removal fallbacks.
- Validate invariants inside the committing database operation. Serialize conflicting
  writes as needed so concurrent refunds, expense changes, category removal, and
  wallet archiving cannot bypass constraints.
- Commit financial changes and internal history atomically. Failed operations leave
  no partial effect. History remains internal rather than part of normal views.

### Archived-wallet refund default: resolved

- Default to the expense's original wallet only if active. If archived, leave the
  receiving wallet unselected and explain that an active wallet must be chosen or
  the original unarchived. Do not silently select a different receiving wallet.
- Without active wallets, show an actionable create/unarchive state and prevent
  submission. Existing refunds on archived wallets remain editable under the
  existing-transaction rule.

### Idempotency and changed-payload retry: resolved

- Assign each logical create submission a key, rather than binding one key to the
  entire form lifetime. Scope receipts to authenticated owner and operation, bind
  them to a canonical validated payload, and commit them with the transaction.
- Same owner/key/payload returns the original result with no new effect, including
  concurrent requests. Same key with a different payload returns an explicit
  conflict, never an overwrite or new transaction. Distinct keys allow intentional
  identical entries.
- Disable Save while submitting. After an uncertain outcome, retain the submitted
  snapshot/key and replay that exact submission before allowing field changes or
  another submission from the form. Explain that the previous save is being checked.
- Confirmed success returns to the saved record; desired corrections use edit.
  Definitive rejection without commit permits correction and a fresh key. A network
  error alone is not definitive rejection.
- New intentional entries after a completed save use new keys. Receipts prevent
  late retries from recreating deleted transactions or restoring values since edited.
- This does not require persistent drafts or offline support. Form values and the
  pending submission are retained within the active entry flow.

### Categories and icons

- Initialize per-user editable copies of defaults once, including one protected
  Uncategorized parent in each income/expense tree. Repeated initialization must
  neither duplicate seeds nor overwrite customization.
- Exactly two levels; either selectable. Parent names are unique within the user's
  tree; children within their parent. Trim surrounding whitespace, compare
  case-insensitively, and reject blank names.
- Allow rename/icon changes; prohibit moving children to different parents.
  Renaming preserves the chosen icon and updates historical labels.
- Child removal atomically reassigns transactions to its parent. Parent removal is
  blocked while any children exist, even unused children; once childless, removal
  atomically reassigns transactions to that tree's Uncategorized. Refunds follow.
- Uncategorized cannot be removed, renamed, or have children; its icon may change.
- Search both levels, show parent › child results grouped under parents, and offer
  creation using the unmatched query as the prefilled name.
- Create parent/child categories, including a missing parent, within an inline
  panel/dialog on transaction create/edit. Do not navigate to management. Save
  categories independently, select immediately, and retain them after transaction
  cancellation. Retain in-screen transaction values; no saved draft is required.
- Ship an immutable catalog of stable unique IDs, Lucide mappings, browsing groups,
  and English tags. Persist icon IDs, not complete catalog definitions. Groups are
  presentation metadata rather than financial categories.
- Recommend up to six icons locally, with consistent normalization, whole-name/token
  matches preferred over weaker matches, deterministic ties, and consideration of
  compound names/short-token false positives. No external AI requirement.
- Require an icon but preselect a guaranteed generic icon. Support group browsing
  and manual overrides. Empty/unmatched queries and failures never block saving;
  unknown/retired stored IDs render the generic icon without silently rewriting IDs.

### Transaction entry and presentation

- Full-screen create/edit and linked refund entry; creation offers Income / Expense /
  Transfer, never Refund. Edit/refund display a fixed type label.
- Defaults: Expense, today in Bangkok, last-used active wallet, and the matching
  tree's Uncategorized. If no active last-used wallet exists, choose the first
  active wallet in deterministic picker order. Refunds use their separate rule.
  Transfers require two distinct active wallets.
- Amount leads, with native decimal keyboard and requested entry focus. Rows:
  wallet, category, date, note. Transfer replaces wallet with From → To plus swap,
  hides category, and transitions without disruptive jumps. Refund shows a linked
  chip with expense category/date/amount/remaining allowance.
- Date-only picker offers Today/Yesterday, still subject to opening-date rules.
  No active wallet shows an actionable empty state instead of a disabled form.
- Phone supports 360px width, safe-area-aware fixed Save, and native keyboard use
  without essential controls obscured. Desktop uses the same order in a centered
  column around 480px, inline Save, Enter from amount to submit, and Esc to cancel.
  Nested panels must not accidentally submit or cancel the outer transaction.
- Save reads back amount and wallet; transfers identify both wallets. Show Saving…
  in flight. Success returns to the transaction list and highlights the saved row.
- Preserve values on errors. Associate/announce inline validation and place server
  errors visibly at the top. Name opening dates/remaining refund allowance in
  relevant errors; show linked refunds when they block deletion.
- Show fixed-type explanation and original recording time on edit. Use stable
  skeletons, restrained motion, reduced-motion support, labeled controls, complete
  keyboard use, 44px minimum touch targets, and 48px minimum phone Save height.
- Follow confirmed clean-modern-fintech direction, light daylight-friendly ground,
  existing fonts, and tabular money. Words/signs carry type; color alone does not.
  Accent is a scoped UI decision to confirm and document during build.
- Representative layout ranges: 1–10 wallets, 8–15 parents per tree, 0–10 children
  per parent, category names around 40 characters. These are test ranges, not
  unconfirmed hard count/name limits.

### Lists and reporting

- Provide transaction list/detail, wallet management/balances, category management,
  and monthly summaries. The form brief's untouched pages remain milestone scope;
  they are simply outside that surface's design brief.
- Filter by date, wallet, category, type. Transfers match either wallet. Parent
  filtering includes its children; child filtering matches that child. Refunds use
  the original expense's current category and display distinctly with an expense
  link. Deleted transactions are excluded from normal lists.
- Monthly boundaries use Bangkok transaction dates. Show income, gross expenses,
  refunds, net expenses (gross minus refunds), and net (income minus net expenses).
  Refunds count in their own month; transfers/openings are excluded.

## Acceptance Criteria

1. Signed-out requests cannot access tracking; substituting another user's resource identifiers cannot read/change their wallets, categories, transactions, receipts, or reports.
2. A wallet opened with ฿12,000 on September 1 accepts opening-day movements, rejects August 31 movements, and cannot have its opening moved past an existing movement.
3. A ฿500 expense and ฿100 refund yield ฿11,600.00 from that opening. Backdating/editing updates appropriate historical/current balances; negative balances are valid.
4. A ฿1,000 transfer changes both wallets together. Failure/edit/delete cannot leave one side applied. Same-wallet transfers fail.
5. Concurrent ฿70 refunds against a ฿100 expense cannot both succeed. Refund edits and expense amount/date/delete changes preserve all linked constraints.
6. Expenses with refunds cannot be deleted or reduced below the refunded total. Valid correction becomes possible after refunds are removed; category changes propagate.
7. Archiving retains balances/history and excludes new entries, while allowing existing entries to be corrected. Zero balance alone does not permit deletion.
8. Refund entry for an archived original wallet requires an explicit active-wallet choice. No active wallets produces a create/unarchive action; server validation also rejects new entries on archived wallets.
9. Expense entry defaults to today, an active wallet, and expense Uncategorized; amount then Save suffices. Type cannot change after creation.
10. ฿0.01 and ฿99,999,999.99 are accepted exactly; empty, zero, negative, extra-decimal, and over-limit inputs fail without rounding. Notes above 200 characters fail.
11. Bangkok midnight governs today/future validation and month boundaries regardless of browser/server locale. Editing preserves original recording time.
12. Same owner/key/payload saves once, even concurrently. Distinct keys allow intentional duplicates; changed payload under the same key conflicts.
13. A lost response causes exact snapshot/key replay before changes are allowed. Success leads to the saved record; definitive no-commit rejection permits correction with a fresh key.
14. A late retry after edit/deletion neither restores old values nor recreates a transaction.
15. Default initialization produces isolated trees and one protected Uncategorized per tree. Repetition creates no duplicates and preserves customization.
16. Both levels are selectable. Blank/scoped duplicate names fail after trim/case normalization; moving or nesting children further fails.
17. Parent/child creation, including a missing parent, stays within transaction create/edit. Category save selects immediately; canceling the transaction keeps the category.
18. Child removal falls back to its parent. Any children block parent removal; childless parent removal falls back to Uncategorized. Refunds follow; protected properties cannot change.
19. Local icon recommendations are deterministic, limited to six, overridable, and never required for save. Generic fallback is guaranteed, including unknown IDs.
20. Filters match transfers through either wallet, descendants under a parent, and refunds as a distinct type linked to their expense.
21. September income ฿1,000, expenses ฿500, refunds ฿100 produce net expenses ฿400 and net ฿600 regardless of transfers. October refunds count in October.
22. Historical balances include the selected day's movements and archived holdings, exclude not-yet-opened wallets, and ignore recording hours for ordering.
23. Successful corrections retain atomic internal history while superseded effects leave balances/reports/normal views. Failed writes have no partial effect.
24. A 360px phone and desktop support legible amount entry and inline category creation with labeled controls, reachable Save, keyboard completeness, and no essential keyboard-obscured controls.
25. Loading, validation, uncertain-save, server-error, and success states retain values as specified and do not present placeholder figures as actual user finances.

## Testing Decisions

- Test external behavior and durable financial results, not SQL text, helper
  structure, component internals, or tests mirroring implementation.
- Primary confirmed seam: authenticated tracking operations against an isolated real
  PostgreSQL test database, reusing existing session/database foundations. Cover
  mutations and balance/report queries, ownership, rejected writes, and concurrency.
- Prefer this single high-level server seam to separate mocks/tests for every
  repository and calculator. Include authentication-boundary coverage proving that
  callers cannot supply or spoof ownership.
- Add a small browser suite for quick entry, inline parent/child creation, refunds,
  archived-wallet fallback, lost-response resolution, validation, and editing, with
  representative phone/desktop, keyboard, and reduced-motion checks.
- Use concurrent requests for duplicates, refund caps, and conflicting expense,
  category, or wallet changes. Control time for Bangkok midnight, opening dates,
  and cross-month refunds. Assert balances, exact amounts, totals, receipts, and
  internal history after success/failure rather than just returned success.
- Prior art: existing authenticated layouts/session helper, Drizzle PostgreSQL
  client/auth schema, shared form controls, and validation tooling. There is no
  tracking implementation, feature test suite, test script, or browser/database
  harness yet. Establish the minimum harness alongside the first end-to-end ticket;
  do not imply existing test examples or select a framework here.
- During implementation, run relevant behavior tests and existing type, lint,
  formatting, and build checks. Use impeccable guidance/visual audit for UI tickets.
  This documentation update does not require application tests.
- The user confirmed the PostgreSQL-backed authenticated operation seam and small
  browser suite during synthesis. No testing-plan checkpoint remains before ticketing.

## Out of Scope

- Budgeting, forecasting, future/scheduled entries, and recurring automation.
- Credit cards, formal double-entry, and event-sourced financial accounting.
- Bank sync, statement imports, third-party financial access, and offline entry.
- Persistent transaction drafts, attachments, split categories, custom calculator keypads.
- Reconciliation and silently overwriting the actual current balance.
- Multiple currencies, exchange rates/currency changes, and Thai translation.
- Shared data, collaborative finances, marketing/onboarding funnels.
- Export/import, public launch/deployment planning, gamification, celebratory motion.

## Further Notes

- Authorities: confirmed product record, glossary, balance-model ADR, transaction-form
  brief, and icon notes. This spec replaces interview rounds without reopening
  their settled decisions.
- Archived-wallet refund fallback and submission-snapshot retry semantics resolve
  the two requested gaps. They supersede the brief's unconditional original-wallet
  default and form-lifetime key wording.
- Remaining scoped design choices: accent and exact default-category/icon contents.
  Confirm these during relevant tickets while preserving established behavior.
  A list quick-add button is not required; v2 keypad decisions are outside scope.
- The ready-for-agent label records specification readiness. Create separate
  dependency-aware tickets that carry
  enough requirements/acceptance criteria for implementation in fresh sessions.
