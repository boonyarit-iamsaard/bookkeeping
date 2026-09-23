# 07: Avatar menu, the Categories entry, and the milestone check

Read `../spec.md` first (Avatar menu, Categories, Testing Decisions, Further Notes).

**What to build:** The Account's actions are reachable without a tab: a
32px initial disc in Home's title bar opens a sheet with the email,
Categories and Sign out, and the desktop account dropdown gains Categories.
The category editor moves onto the restyled sheet. Then the redesign gets its
milestone check: the full browser matrix once, and an `impeccable`
critique/audit of the shipped screens.

**Blocked by:** 02 (Home), 03 (Wallet page and the `/manage` split), 04 (＋ capture), 05 (Transactions filter sheet and chips), 06 (Reports rename and redirect)

**Status:** ready-for-agent

**Out of scope:** fixing what the critique finds (each material finding
becomes its own follow-up ticket in this directory); the DESIGN.md rewrite
(08).

- [ ] Home's title bar shows a 32px Mist disc with the Account email's first letter, uppercased, labelled for assistive technology.
- [ ] The disc opens the sheet with the email in Caption, then Categories and Sign out rows; both work.
- [ ] The stopgap account dropdown in the Wallets title bar on phone (added in 01) is removed.
- [ ] On desktop, the account dropdown lists Categories above Sign out.
- [ ] Categories stays reachable from the category picker.
- [ ] The category editor opens in the restyled sheet on phone and as the dialog from 640px; its content and behaviour are unchanged.
- [ ] The auth and category-management browser specs cover the avatar sheet, the dropdown's Categories entry, Sign out, and the editor sheet.
- [ ] `pnpm run ci` is green.
- [ ] The full three-project browser matrix (`phone-chromium`, `phone-webkit`, `desktop-chromium`) runs once, alone, and passes; any failure is fixed or filed.
- [ ] An `impeccable` critique/audit of the shipped shell, Home, wallet page, Transactions and Reports runs against `../spec.md`, and each material finding is filed as a follow-up ticket in `issues/`, numbered after 08.

**Verify:** `pnpm run ci`, then the full browser matrix alone (`pnpm run ci:e2e` or the three projects in one run), never alongside another heavy task.

## Comments

From 01 (2026-09-23): the desktop dropdown already lists Categories above Sign
out, because removing the old header's Categories link left the page with no
entry point; this ticket still owns its browser coverage beyond the auth
spec's check. On phone, 01 put the dropdown in the Wallets title bar so
sign-out stays reachable; the criterion above removes it once Home's disc
ships. Note for "Categories stays reachable from the category picker": the
picker has no link to `/categories` today (it creates categories inline), so
that criterion needs deciding rather than keeping.
