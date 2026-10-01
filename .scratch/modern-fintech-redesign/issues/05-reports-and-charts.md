# 05: Reports with the level 1–2 charts

Read `../design-brief.md` first (Scope, Not in scope: level 3 data), then the
`DESIGN.md` written by 01.

**What to build:** Reading a month's results happens on the new system, with
charts. Reports shows the month and balance-date pickers, the month figures,
the level 1 charts (this month's Income against Net expenses, and each
wallet's share of the total), and the level 2 six-month Income and Net
expenses trend. Home gains its level 1 chart from the same chart component.

**Blocked by:** 01 (Foundation: system, shell and Home)

**Status:** ready-for-agent

**Out of scope:** level 3 data: spending by category and balance over time.
They need new server-calculated reads and run as a separate feature.

- [ ] One chart component built on 01's chart color tokens, legible in light and dark, at 360px and from 640px, with values available as text for assistive technology.
- [ ] Level 1 on Reports: this month's Income against Net expenses, from the monthly report.
- [ ] Level 1 on Reports: each wallet's share of the total, from wallet as-of balances; negative balances and archived wallets are shown honestly, not hidden.
- [ ] Level 2 on Reports: the six-month Income and Net expenses trend, built from six `/v1/reports/monthly` calls and nothing else.
- [ ] Home gains the level 1 chart named in 01's direction contract, using the same component.
- [ ] Series are distinguished by label, pattern, or position as well as color; red and green are never the only signal.
- [ ] Month and balance-date pickers still apply immediately on selection; invalid values stay visible.
- [ ] Reports loading skeletons (never sample money or sample bars) and the error screen use 01's patterns.
- [ ] `DESIGN.md` records the chart component as a stated system change, and specifies the level 3 category breakdown bar and trend chart style for the later feature to adopt, without building them.

## Constraints

- Visual only: no API, schema, or backend change. Charts use only `/v1/reports/monthly` and wallet as-of balances. Level 3 (spending by category, balance over time) is out of scope; never fake it with client-side sums.
- Behavior, routes, copy, domain vocabulary (`CONTEXT.md`), and accessible names stay as they are. Existing unit and browser tests keep passing without their assertions being rewritten to fit.
- Every phone control keeps a 44 by 44 CSS pixel target; transaction type, sign, and direction never rely on red or green alone; motion is removed under reduced motion. Check at 360px and from 640px, in light and dark.
- Never use production data in screenshots, comps, or fixtures; sample money is clearly placeholder.

**Verify:** `pnpm run ci`, then the reports spec alone on one project (`phone-chromium`). Follow the local resource limits in `CLAUDE.md`.
