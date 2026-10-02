# Level 3 reports: category spending and balance over time

Status: ready-for-agent

Decided on 2026-10-02 by grilling. This is the level 3 data that
`.scratch/modern-fintech-redesign/design-brief.md` deferred. Read
`CONTEXT.md` (**Category spending**, **Closing balance**), ADR 0001, ADR 0011
and ADR 0012 first. The visual components are already specified in
`DESIGN.md` under Charts, "Level 3 (specified, not built)"; adopt them as
written and do not reopen them.

## Problem Statement

The owner keeps real finances in the app. Reports tells them how much came in
and went out each month, but not where the money went or how their wallets'
balances moved through the month. To answer "what did I spend on" or "when did
my balance dip", they have to scroll the transaction list and add figures in
their head, or go back to the spreadsheet the app replaced.

## Solution

Reports gains two sections for the chosen month, both calculated by the server:

- **Spending by category**: the month's Net expenses broken down by expense
  parent category as the category breakdown bar, with a legend row per parent
  that expands to its children. It always adds up to the Net expenses already
  shown on the page.
- **Balance over time**: the daily Closing balance of all wallets combined
  across the chosen month as the balance trend, with one wallet optionally
  drawn as a second line, and a selected day whose figures are read out.

## User Stories

1. As the owner, I want to see the chosen month's spending broken down by parent category, so that I know where my money went.
2. As the owner, I want the category breakdown to add up to the month's Net expenses, so that Reports never shows two disagreeing figures.
3. As the owner, I want debt payments counted as spending under their own category, so that card bills and mortgage payments show where the cash actually went.
4. As the owner, I want a refund to reduce spending in the month it is dated, so that a past month does not change when a refund arrives later.
5. As the owner, I want a refund to reduce its expense's category, so that returned money comes off the category it was spent in.
6. As the owner, I want each parent's exact amount stated beside its legend swatch, so that I never have to read a figure off a bar.
7. As the owner, I want each parent's share of spending stated as text, so that I can compare categories at a glance without estimating segment widths.
8. As the owner, I want parents ordered in my category order, so that the breakdown matches how I arranged my categories.
9. As the owner, I want to expand a parent's legend row to see its children's amounts, so that I can see which child drove a large parent.
10. As the owner, I want an expanded parent to show the amount filed directly on the parent, so that the children plus that line add up to the parent.
11. As the owner, I want Uncategorized shown as its own hatched neutral segment, placed last, so that unfiled spending is visible but not mistaken for a real category.
12. As the owner, I want Uncategorized hidden when it has no spending in the month, so that an empty fallback does not clutter the breakdown.
13. As the owner, I want parents with no activity in the month left out, so that the legend only lists categories I used.
14. As the owner, I want a category where more was refunded than spent shown with its true minus below the bar, so that negative figures are honest without breaking the bar.
15. As the owner, I want a negative child shown with its minus in the expanded list, so that children still add up to their parent.
16. As the owner, I want no bar when the whole month's Net expenses is zero or negative, so that I am not shown a meaningless proportion.
17. As the owner, I want shares stated as a share of positive spending when some categories are negative, so that the percentages make sense.
18. As the owner, I want past breakdowns to follow my current categories, so that recategorizing or removing a category is reflected everywhere at once.
19. As the owner, I want a month with no expenses or refunds to say "No spending in" that month, so that an empty month is clearly empty and not still loading.
20. As the owner, I want the spending breakdown to follow the month chosen on Reports, so that the hero, flow bars and breakdown all describe the same month.
21. As the owner, I want a line of the total Closing balance across all my wallets for each day of the chosen month, so that I can see how my money moved during the month.
22. As the owner, I want archived wallets included in the total, so that the line matches the Wallet balances total.
23. As the owner, I want to pick one wallet as a second line, including an archived one, so that I can see how that wallet moved against the total.
24. As the owner, I want an archived wallet labeled "· Archived" in the picker, so that I know which wallets are closed.
25. As the owner, I want only one wallet line at a time, so that the chart stays readable on a phone.
26. As the owner, I want a wallet line to start on its opening date, so that a wallet is not drawn as zero before I started tracking it.
27. As the owner, I want the total line to start on the earliest opening date in the month, so that it does not drop from zero.
28. As the owner, I want the line to stop at today in the current month, so that future days are not drawn as flat balances.
29. As the owner, I want the selected day to start at the Balance date when it falls in the chosen month, so that the page shows one as-of day.
30. As the owner, I want the selected day to start at the month's last tracked day otherwise, so that the readout opens on the most recent figure.
31. As the owner, I want the selected day's exact Closing balance read out, so that I never have to read a figure off the line.
32. As the owner, I want the zero line drawn when any balance in view is negative, so that an overdrawn day is obvious.
33. As the owner, I want balance over time to ignore recording time and change history, so that the figures follow the same rule as every other balance in the app.
34. As the owner, I want transfers to leave the total unchanged and move only the wallet lines, so that moving money between my own wallets does not look like earning or spending.
35. As the owner, I want a clear line of text when I have no wallets or the whole month is before every opening date, so that an absent chart is explained.
36. As the owner, I want a future month to say there is nothing yet, so that I am not shown an empty chart as if data were missing.
37. As the owner, I want skeletons while either section loads, never sample money, so that I never mistake placeholder figures for my own.
38. As a screen reader user, I want every figure in both sections available as text or a hidden table, so that the charts do not hide information from me.
39. As the owner on a phone, I want both sections to work at 360px with 44px controls, so that I can use them one-handed.
40. As the owner, I want both sections placed next to the blocks they relate to, so that the page reads in order: the month's figures, spending, the six-month trend, wallet balances, then balance over time.

## Implementation Decisions

- **Category spending rules (ADR 0012).** Category spending for a month is
  expenses dated in the month minus refunds dated in the month, grouped by the
  expense's current category; a refund has no category of its own and always
  reads its expense's. Debt payments are an ordinary parent category and count.
  The sum over all categories equals the monthly report's Net expenses for the
  same month; the read is built so this holds by construction, not by
  reconciliation.
- **Closing balance rules (ADR 0001).** A wallet's Closing balance on a date is
  its opening balance plus every current (nondeleted) transaction dated on or
  before that date, by Bangkok calendar date. The total is the sum over all
  wallets, archived included, that have opened by that date. This is the same
  derivation the Balance date already uses.
- **New read: category spending.** `GET /v1/reports/category-spending?month=YYYY-MM`,
  reusing the monthly report's month query schema and strictness. The response
  carries the month, its Net expenses, and one row per expense parent with any
  activity in the month. A row has the parent's id, name, sort order, an
  Uncategorized flag, its signed category spending, the signed amount filed
  directly on the parent, and a list of children, each with id, name, sort
  order and signed amount. Children with no activity are left out. Money uses
  the existing money schema (exact decimal strings in minor units). The
  response gets its own named OpenAPI schema.
- **New read: closing balances.** `GET /v1/reports/closing-balances?month=YYYY-MM&walletId=<optional>`.
  The response carries the month and one entry per date from the month's first
  day through its last day or today (Bangkok), whichever is earlier, with the
  total Closing balance and, when a wallet is requested, that wallet's Closing
  balance. A date before every wallet's opening date, or before the requested
  wallet's opening date, carries null for that figure, not zero. A wallet id
  the owner does not own is a not-found problem, like other owner-scoped reads.
  A future month returns no entries.
- **The server only sums.** Both reads are aggregate queries in the
  application layer beside the monthly summary, owner-scoped from the session,
  never from a client-supplied owner. The client never sums transactions; it
  only derives presentation from these responses.
- **Client presentation derivations**, as pure functions beside the existing
  trend series derivation:
  - From category spending: the ordered positive segments for the bar (by sort
    order, Uncategorized last), each with its share of positive spending; the
    negative parents listed beneath the bar under "More refunded than spent";
    whether a bar is drawn at all (not when Net expenses is zero or less); and
    the empty state when there are no rows.
  - From closing balances: the total series and optional wallet series with
    gaps where figures are null, whether the zero line is needed, and the
    default selected day (the Balance date when it is in the month and has an
    entry, otherwise the last entry).
- **Reports page.** The order becomes: hero, month card, Spending by category,
  Last six months, Wallet balances, Balance over time. Spending by category
  follows the Reports month. Balance over time follows the Reports month and
  takes its initial selected day from the Balance date as above. Its wallet
  picker lists every wallet, archived ones labeled "· Archived", with none
  selected by default. Loading and error states reuse the page's existing
  skeleton and report error boundary.
- **Visuals.** Use the category breakdown bar and the balance trend exactly as
  `DESIGN.md` specifies them, with the existing chart tokens and no charting
  library.
- **No schema change.** Category sort order, the Uncategorized flag, wallet
  opening dates and refund links all exist already.

## Testing Decisions

- Good tests here assert what the owner or a client sees: response bodies over
  HTTP and derived presentation data. They do not assert query shapes, SQL, or
  component internals.
- **Server route integration tests** for both reads, following the existing
  monthly report route integration test: real database with rollback, an owner
  session, default categories, and the transaction fixture. Cover:
  - category spending equals the monthly report's Net expenses for the same
    month, including debt payments;
  - a refund dated in a later month reduces that later month under its
    expense's category, and leaves the earlier month alone;
  - a parent and a child going negative;
  - amounts filed directly on a parent versus on its children;
  - Uncategorized present only with activity, and flagged;
  - recategorizing an expense moves it and its refunds in past months;
  - closing balances matching the wallet collection's as-of balances on the
    same date;
  - transfers leaving the total unchanged;
  - null before an opening date, entries stopping at today, an empty future
    month, archived wallets included, and a foreign wallet id rejected;
  - month validation and authentication problems, as for the monthly report.
- The existing OpenAPI and API contract tests must pass with the new
  schemas registered, and the generated web client is regenerated.
- **Web unit tests** for both derivation modules, in the style of the existing
  trend series tests: ordering, Uncategorized last, shares of positive
  spending, negative rows, no bar at zero or below, empty state, series gaps,
  zero-line detection, and the default selected day.
- **One focused browser case** in the existing Reports spec on one project,
  under the repository's browser test policy: both sections render from real
  reads for a month with data, and both empty states show for an empty month.

## Out of Scope

- An income breakdown by category. The reads can be extended by type later.
- Any change to Home.
- Ranges other than the chosen month for either section (quarters, years,
  custom ranges, a 12-month balance view).
- A consumption view that excludes debt payments; that needs its own decision
  and a category flag.
- Categories as of the transaction date; breakdowns always use current
  categories.
- More than one compared wallet line.
- Any change to the visual specs in `DESIGN.md`.

## Further Notes

- The new glossary terms (**Category spending**, **Closing balance**) and
  ADR 0012 were written during the grilling and are not yet committed.
- Category spending can be negative for a month, by design: a refund dated
  after its expense's month reduces the refund's month.
