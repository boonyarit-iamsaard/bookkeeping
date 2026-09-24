# 14: The Reports month picker clips its own month

Read `../spec.md` first.

**What to build:** The month picker in the Reports title bar shows the chosen month in full at every width.

**Blocked by:** None (can start immediately)

**Status:** done

**Out of scope:** the balance-date control and the report's content.

- [x] At 360px and 1280px the trigger reads the whole month ("September 2026", or an agreed short form such as "Sep 2026" on phone) with no ellipsis.
- [x] The reports browser spec's title-row test also asserts the month text is not clipped.

## Comments

From 07's milestone critique (2026-09-24): P2, material (layout: the screen's main control clips its value at both widths). `MonthPicker` is fixed at `className="w-44"` in `apps/web/src/features/reports/components/reports.tsx:76`; its label truncates in `apps/web/src/shared/components/month-picker.tsx:160`. At 360px "September 2026" needs 127px and gets 94px ("Septembe…"). Flagged by both assessments.

Triaged (2026-09-24): in scope with the rest of 12–18, after 13.

Closed (2026-09-24):

- Built in 430f038. The Reports title bar's `MonthPicker` is `w-auto`
  instead of `w-44`, so the trigger sizes to its month inside the title's
  `shrink-0` actions; at 360px "September 2026" fits with the "Reports" h1
  beside it. The shared picker keeps `truncate` as a guard for other callers.
- `pnpm run ci` passes. The title-row test in `reports.spec.ts` opens
  September 2026 and asserts the month value's `scrollWidth` is at most its
  `clientWidth`; it passes on `phone-chromium` and `desktop-chromium`, and
  failed on `phone-chromium` before the fix.
