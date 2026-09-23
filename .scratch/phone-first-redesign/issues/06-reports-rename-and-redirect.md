# 06: Reports rename and redirect

Read `../spec.md` first (Reports, Routes).

**What to build:** The monthly summary becomes Reports at `/reports`, reached
from the Reports tab and header link, with the month picker in the title bar.
Old `/dashboard` links land on Reports with their month and balance date kept.

**Blocked by:** 01 (Shell: tab bar, desktop header, title bar and standalone chrome)

**Status:** ready-for-agent

**Out of scope:** the report's content and its order, which do not change.

- [ ] `/reports` renders the monthly summary with the same `month` and `asOf` search values as today; its h1 and document title are "Reports".
- [ ] `/dashboard` redirects to `/reports`, keeping the query string; the query carry-over is a pure function with a unit test.
- [ ] The Reports tab and the desktop header's Reports link point to `/reports` and are current there.
- [ ] Home's This month block links to `/reports` for the month.
- [ ] The month picker sits in the title bar on phone and beside the h1 on desktop; the balance-date control, content and order stay as they are.
- [ ] The dashboard browser spec becomes the reports spec and covers the redirect keeping `month` and `asOf`.

**Verify:** `pnpm run ci`, then the touched spec alone on `phone-chromium`.

## Comments
