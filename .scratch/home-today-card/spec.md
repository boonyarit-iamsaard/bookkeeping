# Home Today card

Status: done

Decisions confirmed on 2026-11-04 by grilling; this spec is the full decision
record. Inputs: `CONTEXT.md`, `DESIGN.md` (Summary card, Flow bars, loading),
`.scratch/phone-first-redesign/spec.md` (Home) and
`docs/adr/0006-vite-tanstack-router-spa-client.md`.

## Problem Statement

Home's summary card answers "how is this month going", but not "how is today
going". Seeing today's income and net expenses means opening Transactions,
filtering to today and adding the rows up in your head.

## Solution

Home's summary card becomes a swipeable strip of two summary cards: **Today**
first, then **This month**. Today shows Income, Net expenses and Net for the
current Bangkok date, with the same figures, bars and rules as This month, and
opens the transaction history filtered to today.

## User Stories

1. As the account holder, I want Home to open on today's Income, Net expenses and Net, so that I see how today is going without leaving Home.
2. As the account holder, I want to swipe from Today to This month, so that the month's figures stay one gesture away.
3. As a mouse or keyboard user, I want dots I can click or focus to switch cards, so that I can reach both cards without a touch screen.
4. As the account holder, I want tapping Today to open my transactions dated today, so that I can see what makes up its figures.
5. As the account holder, I want a refund dated today to lower today's net expenses, even when it returns an older expense, so that Today follows the same rules as This month.
6. As the account holder, I want a day with no transactions to show ฿0.00 figures without bars, so that an empty day looks like an empty month.
7. As the account holder, I want Today to move to the new date at Bangkok midnight, so that the card never shows yesterday as today.
8. As a screen reader user, I want the strip announced as one Summary region, with each card keeping its own heading and each dot named after its card, so that I know which card is showing.

## Implementation Decisions

### Domain

- **Today** is the current calendar date in `APP_TIME_ZONE` (Asia/Bangkok).
  A transaction belongs to Today by its **transaction date**, never its
  **recording time**.
- Today's figures use the **Net expenses** and **Net** definitions in
  `CONTEXT.md`, the same as the month: income, expenses less refunds dated
  that day, and income less net expenses. Transfers are excluded. Net expenses
  may be negative.

### Server

- New `GET /v1/reports/daily?date=YYYY-MM-DD`. The query is a strict object
  with one valid calendar `date`. The response is the monthly report's figures
  (`income`, `grossExpenses`, `refunds`, `netExpenses`, `net`,
  `transactionCount`), with `date` in place of `month`.
- `getMonthlySummary` and the new daily summary share one date-range summary
  (inclusive `start` and `end` calendar dates). The month passes its
  `monthBounds`; the day passes `start = end = date`. No second copy of the
  net-expense rules.
- The server does not pick "today"; the client sends the date. No schema
  change and no migration.

### Client

- Add `reportQueries.daily(date)` beside `reportQueries.monthly` in
  `apps/web/src/core/api/queries.ts`.
- `createHomeQueryPlan(today)` adds `daily: reportQueries.daily(today)`. The
  Home route loader prefetches it with the monthly report and wallets, so
  swiping to This month never waits.
- The Today card is the existing summary card for a different period. Generalize
  `ThisMonth` rather than copying it: the heading, the link target and the
  report vary; the figures, arrow tiles, Net row and Flow bars are shared.
  - Heading "Today", with no date shown.
  - Link to `/transactions?from=<today>&to=<today>` (the history screen's
    existing filters), named by the heading, with the chevron and the
    stretched whole-card hit area of the month card.
  - Bars only when `transactionCount > 0`; otherwise ฿0.00 figures and no bars,
    with no empty-state message.
- `useBangkokToday` already rolls over at Bangkok midnight and on focus; the
  daily query key follows `today`, so Today updates with no extra code.

### Swipe strip

- A native horizontal CSS scroll-snap strip (`snap-x snap-mandatory`, one card
  per snap point). No carousel library.
- Same behavior at every width, including the `lg` two-column layout.
- Order: Today, then This month. Home always opens on Today; the position is
  not remembered across visits or reloads.
- Dot indicators beneath the strip: one button per card, named after its card
  ("Today", "This month"). The current card's dot is marked (`aria-current`)
  and clicking a dot scrolls its card into view. The current card is tracked
  from the scroll position (for example, an `IntersectionObserver` on the
  cards).
- The strip is one region labelled "Summary". Each card keeps its own heading
  and link. Arrow-key scrolling of the focused strip is left to the browser.
- Vertical page scroll must not be captured: the strip scrolls only on the x
  axis.
- The strip plays as one `Arrival` slot (order 1), as the month card does now.
- The loading skeleton stays one summary card.

### Docs

- `DESIGN.md`: the Summary card entry covers both cards and the strip with its
  dots; Flow bars says "when the period has transactions"; the Home layout
  notes Today first. `DESIGN.md` describes what shipped, so update it in the
  same change.
- `CONTEXT.md` already defines **Net expenses** and **Net** (added with this
  spec).

## Testing Decisions

- **What a good test is:** it checks behavior a consumer would notice: the
  figures a request returns, or what the account holder sees and can do,
  through roles, labels and visible text.
- **Server unit tests** in `report.routes.unit.test.ts`: the daily query
  rejects a missing, malformed or impossible date (`2026-02-30`) and extra
  keys.
- **Server integration test** in `report.routes.integration.test.ts`: for one
  date, income, an expense, a refund of an expense from an earlier date and a
  transfer give the expected income, gross expenses, refunds, net expenses
  (refund subtracted), net and transaction count (transfer excluded).
  Transactions on the day before and after are excluded. Another account's
  transactions are excluded. The monthly tests still pass on the shared range
  summary.
- **Home browser spec** (`apps/web/tests/e2e/home.spec.ts`), one focused run
  on one project: Home shows Today first with today's figures; the This month
  dot shows the month card; the Today link opens history filtered to today;
  a fresh user's Today shows ฿0.00 figures.
- **Gates:** `pnpm run ci`, then the Home spec alone on `phone-chromium`. No
  full browser matrix.

## Out of Scope

- Any period besides Today and This month (no This week, Yesterday or custom
  range).
- Remembering the last card viewed.
- A day view on Reports, or a Reports `date` parameter.
- Showing today's date on the card, or an empty-day message.
- Per-account time zones.
- New colours, type or tokens.

## Further Notes

- One ticket: `issues/01-today-summary-card.md`.
- No ADR: the daily endpoint and the strip are easy to reverse and follow
  existing patterns.
