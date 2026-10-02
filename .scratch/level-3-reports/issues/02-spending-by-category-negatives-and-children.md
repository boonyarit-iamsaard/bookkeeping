# 02: Spending by category: negative categories and children

Read `../spec.md` first. It is the spec; do not reopen its decisions.

**What to build:** The spending breakdown stays honest when refunds outrun
spending, and can be drilled into. Each parent's legend row expands to its
children's amounts and, when non-zero, the amount filed directly on the
parent, so the lines add up to the parent. A parent whose category spending
is negative in the month (a refund dated after its expense's month) leaves
the bar and is listed beneath it with its true minus under "More refunded
than spent"; a negative child shows its minus in the expanded list. Shares
become a share of positive spending. When the month's Net expenses is zero or
less, no bar is drawn and only the legend rows show. Past months follow
current categories.

**Blocked by:** 01

**Status:** done

- [x] The category-spending read adds, per parent, the signed amount filed directly on it and a list of children with activity (id, name, sort order, signed amount); the OpenAPI schema and generated client follow
- [x] Route integration tests: a refund dated in a later month reduces the later month under its expense's category and leaves the earlier month unchanged; a parent and a child going negative; direct-on-parent versus child amounts; recategorizing an expense moves it and its refunds in past months; the sum still equals Net expenses
- [x] The derivation separates positive segments from negative rows, computes shares of positive spending, and reports when no bar is drawn; unit tested
- [x] Expanding a legend row is keyboard and screen reader operable, with 44px targets on phone
- [x] `pnpm run ci` passes, and the focused Reports browser case still passes on one project

Closed by aba17cd: the read adds directSpending and children per parent, the derivation splits positive segments from "More refunded than spent" rows with shares of positive spending and no bar at zero or below, and parents with children expand as disclosure buttons. A parent whose activity nets to zero stays in the legend at 0% with no bar segment.
