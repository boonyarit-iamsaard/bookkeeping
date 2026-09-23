# 06: Reports rename and redirect

Read `../spec.md` first (Reports, Routes).

**What to build:** The monthly summary becomes Reports at `/reports`, reached
from the Reports tab and header link, with the month picker in the title bar.
Old `/dashboard` links land on Reports with their month and balance date kept.

**Blocked by:** 01 (Shell: tab bar, desktop header, title bar and standalone chrome)

**Status:** done

**Out of scope:** the report's content and its order, which do not change.

- [x] `/reports` renders the monthly summary with the same `month` and `asOf` search values as today; its h1 and document title are "Reports".
- [x] `/dashboard` redirects to `/reports`, keeping the query string; the query carry-over is a pure function with a unit test.
- [x] The Reports tab and the desktop header's Reports link point to `/reports` and are current there.
- [x] Home's This month block links to `/reports` for the month.
- [x] The month picker sits in the title bar on phone and beside the h1 on desktop; the balance-date control, content and order stay as they are.
- [x] Home, Reports and the wallet page each show their own load-error copy; none mentions filters (all borrow the Transactions error screen today, whose copy says the filters in the address are kept). The wallet page's should also offer back to Wallets, since an unknown or deleted wallet lands there.
- [x] The report month for a Bangkok date comes from one named helper, used by the report search defaults and Home's month read (both use `today.slice(0, 7)` today).
- [x] The Income, Net expenses and Net row labels have one owner, shared by the report and Home's This month block.
- [x] The dashboard browser spec becomes the reports spec and covers the redirect keeping `month` and `asOf`.

**Verify:** `pnpm run ci`, then the touched spec alone on `phone-chromium`.

## Comments

From 02 (2026-09-23): the three criteria on error copy, the report month and
the row labels came from 02's code review. They change no figures, and the
report's content and order stay as they are.

From 06's code review (2026-09-23): the Wallets screen's "Monthly summary &
balances" link is removed, as Transactions' was in 05; the Reports tab and
header link are the ways in. Reports has its own loading skeleton instead of
the Transactions one, and an `@matrix` browser test checks the month picker
on the title's row at phone and desktop widths.
