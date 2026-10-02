# 05: Reports with the level 1–2 charts

Read `../design-brief.md` first (Scope, Not in scope: level 3 data), then the
`DESIGN.md` written by 01.

**What to build:** Reading a month's results happens on the new system, with
charts. Reports shows the month and balance-date pickers, the month figures,
the level 1 charts (this month's Income against Net expenses, and each
wallet's share of the total), and the level 2 six-month Income and Net
expenses trend. Home gains its level 1 chart from the same chart component.

**Blocked by:** 01 (Foundation: system, shell and Home)

**Status:** done

**Out of scope:** level 3 data: spending by category and balance over time.
They need new server-calculated reads and run as a separate feature.

- [x] One chart component built on 01's chart color tokens, legible in light and dark, at 360px and from 640px, with values available as text for assistive technology.
- [x] Level 1 on Reports: this month's Income against Net expenses, from the monthly report.
- [x] Level 1 on Reports: each wallet's share of the total, from wallet as-of balances, drawn as horizontal bars from a zero line rather than a pie or ring (a ring cannot show a negative slice). Negative wallets extend left of zero and are labeled with their signed amount; archived wallets keep their Archived label; the total is stated as text.
- [x] Level 2 on Reports: the six-month Income and Net expenses trend, built from six `/v1/reports/monthly` calls and nothing else.
- [x] Home gains the level 1 chart named in 01's direction contract, using the same component.
- [x] Series are distinguished by label, pattern, or position as well as color; red and green are never the only signal.
- [x] Month and balance-date pickers still apply immediately on selection; invalid values stay visible.
- [x] Reports loading skeletons (never sample money or sample bars) and the error screen use 01's patterns.
- [x] `DESIGN.md` records the chart component as a stated system change, and specifies the level 3 category breakdown bar and trend chart style for the later feature to adopt, without building them.

## Constraints

- Visual only: no API, schema, or backend change. Charts use only `/v1/reports/monthly` and wallet as-of balances. Level 3 (spending by category, balance over time) is out of scope; never fake it with client-side sums.
- Behavior, routes, copy, domain vocabulary (`CONTEXT.md`), and accessible names stay as they are. Existing unit and browser tests keep passing without their assertions being rewritten to fit.
- Every phone control keeps a 44 by 44 CSS pixel target; transaction type, sign, and direction never rely on red or green alone; motion is removed under reduced motion. Check at 360px and from 640px, in light and dark.
- Never use production data in screenshots, comps, or fixtures; sample money is clearly placeholder.

**Verify:** `pnpm run ci`, then the reports spec alone on one project (`phone-chromium`). Follow the local resource limits in `CLAUDE.md`.

## Closing note

### 2026-10-02: done

Built in `511ac81`. One chart family in plain HTML on 01's chart tokens, with
no charting library: a horizontal bar on a shared zero line (`BarTrack`),
Income against Net expenses (`FlowBars`), the wallet share bars, and the
six-month trend columns. Net expenses and a negative wallet are hatched as
well as colored, labels and positions carry the rest, and a hidden table
carries the trend's figures. The Iris and Amber pair passed the dataviz
validator in both schemes.

Test-first logic: `scaleBars` (zero-line scaling, negatives left, seven
figures) and `trendMonths` and `createTrendSeries` (the six-month window and
series) each have a unit test. The trend is six `/v1/reports/monthly` calls
and nothing else; the wallet bars use the as-of balances. Level 3 is
specified in `DESIGN.md` and not built.

Stated system changes, all in `DESIGN.md` (a new Charts section, two Do's
and Don'ts): the chart component, and the Reports page composition: the
Midnight hero is the month's Net, then Cards for the month, Last six months,
and Wallet balances. The Balance date field now sits in the Wallet balances
card, with a standalone card when its value is invalid so it stays visible.
Home's This month gains the Income and Net expenses bars (hidden from
assistive technology, since its figures say the same in text).

Carry-over: with wallets of very different size, a small negative balance is
an honest sliver left of a long zero line, labeled with its signed amount.
The per-wallet current and dated rows below the chart repeat what the bars
show; the tests rely on them, so they stayed.

Verified: `pnpm run ci` passes, and `reports.spec.ts` (4 passed) and
`home.spec.ts` (3 passed) pass on `phone-chromium` with no assertion
changed and no dates paged. Inspected at 360px and 1280px in light and dark
on a throwaway local database with placeholder data: a month with income and
expenses, an empty month with an all-empty trend, one wallet and ten, a
negative and an archived wallet, a trend with empty months, seven-figure
amounts, Home with its chart, and the loading and error states. The empty
trend first drew a blank plot; it now reads as one line of text. `/code-review`
found no breach of a documented standard and no spec gap; its smell fixes
(one shared `toPercent`, clearer trend variable names) are in the commit.
