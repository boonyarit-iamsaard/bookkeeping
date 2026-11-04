# 01: Today summary card

Read `../spec.md` first.

**What to build:** Home's summary card becomes a swipeable strip of Today,
then This month. Today shows Income, Net expenses and Net for transactions
dated on the current Bangkok date, from a new daily report endpoint, and links
to the transaction history filtered to today.

**Blocked by:** none

**Status:** done

**Out of scope:** other periods, remembering the shown card, a Reports day
view, schema changes.

- [x] `GET /v1/reports/daily?date=YYYY-MM-DD` returns `date`, `income`, `grossExpenses`, `refunds`, `netExpenses`, `net` and `transactionCount` for the signed-in account, and rejects a missing, malformed or impossible date and extra keys.
- [x] Monthly and daily summaries share one inclusive date-range summary in `packages/application`; the monthly report's response is unchanged.
- [x] `reportQueries.daily(date)` exists, and the Home loader prefetches the daily and monthly reports with wallets.
- [x] Home's summary area is a horizontal scroll-snap strip, a region labelled "Summary", with Today first and This month second at every width. Home opens on Today every visit.
- [x] The Today card reuses the month card's figures, arrow tiles, Net row and Flow bars. Its heading is "Today", and it links to `/transactions?from=<today>&to=<today>` with the whole card as the hit area.
- [x] With no transactions today, Today shows ฿0.00 figures and no bars.
- [x] Dots beneath the strip are buttons named "Today" and "This month". The shown card's dot is marked current, and clicking a dot scrolls to its card.
- [x] Today moves to the new date at Bangkok midnight and on refocus (via `useBangkokToday`).
- [x] The loading skeleton stays one summary card. The strip plays as one Arrival slot.
- [x] `DESIGN.md` describes the two summary cards, the strip and its dots, and Flow bars per period.
- [x] Server unit and integration tests and the Home browser spec cover the cases in the spec's Testing Decisions.

**Verify:** `pnpm run ci`, then `home.spec.ts` alone on `phone-chromium`.

## Comments

Closed 2026-11-04. Built in `c8094a6` (feat: add a today card to the home
summary strip) and `9ca1ba3` (fix(reports): prove the today card and share
report figures); `DESIGN.md` lands in `3ed00ca` (docs: describe the home
today card and summary strip). Verified: `pnpm run ci` green, then
`home.spec.ts` alone on `phone-chromium`, 3 passed.

Review against `main`: the daily route suite now asserts only a happy-path
round trip with ownership, zeros, one bad request and authentication. The
Testing Decisions' refund, transfer and neighbour cases stay with
`getDailySummary` in `transaction-reports.integration.test.ts`, per
`docs/code-conventions.md#test-ownership`. The daily route tests live in
`report.daily.routes.integration.test.ts` because
`report.routes.integration.test.ts` is on the token-budget baseline and may
not grow.

Re-verified after the review edits, in `bc36099` (refactor(reports): trim the
daily route suite and inline summary cards): `pnpm run ci` green, then
`home.spec.ts` alone on `phone-chromium`, 3 passed.

Owner approved on 2026-11-04: `DESIGN.md` stays on the token-budget baseline
at 52,630 bytes, and the daily route tests stay in
`report.daily.routes.integration.test.ts`.
