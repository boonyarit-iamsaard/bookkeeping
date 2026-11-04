# 01: Today summary card

Read `../spec.md` first.

**What to build:** Home's summary card becomes a swipeable strip of Today,
then This month. Today shows Income, Net expenses and Net for transactions
dated on the current Bangkok date, from a new daily report endpoint, and links
to the transaction history filtered to today.

**Blocked by:** none

**Status:** ready-for-agent

**Out of scope:** other periods, remembering the shown card, a Reports day
view, schema changes.

- [ ] `GET /v1/reports/daily?date=YYYY-MM-DD` returns `date`, `income`, `grossExpenses`, `refunds`, `netExpenses`, `net` and `transactionCount` for the signed-in account, and rejects a missing, malformed or impossible date and extra keys.
- [ ] Monthly and daily summaries share one inclusive date-range summary in `packages/application`; the monthly report's response is unchanged.
- [ ] `reportQueries.daily(date)` exists, and the Home loader prefetches the daily and monthly reports with wallets.
- [ ] Home's summary area is a horizontal scroll-snap strip, a region labelled "Summary", with Today first and This month second at every width. Home opens on Today every visit.
- [ ] The Today card reuses the month card's figures, arrow tiles, Net row and Flow bars. Its heading is "Today", and it links to `/transactions?from=<today>&to=<today>` with the whole card as the hit area.
- [ ] With no transactions today, Today shows ฿0.00 figures and no bars.
- [ ] Dots beneath the strip are buttons named "Today" and "This month". The shown card's dot is marked current, and clicking a dot scrolls to its card.
- [ ] Today moves to the new date at Bangkok midnight and on refocus (via `useBangkokToday`).
- [ ] The loading skeleton stays one summary card. The strip plays as one Arrival slot.
- [ ] `DESIGN.md` describes the two summary cards, the strip and its dots, and Flow bars per period.
- [ ] Server unit and integration tests and the Home browser spec cover the cases in the spec's Testing Decisions.

**Verify:** `pnpm run ci`, then `home.spec.ts` alone on `phone-chromium`.

## Comments
