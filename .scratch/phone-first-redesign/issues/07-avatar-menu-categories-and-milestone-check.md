# 07: Avatar menu, the Categories entry, and the milestone check

Read `../spec.md` first (Avatar menu, Categories, Testing Decisions, Further Notes).

**What to build:** The Account's actions are reachable without a tab: a
32px initial disc in Home's title bar opens a sheet with the email,
Categories and Sign out, and the desktop account dropdown gains Categories.
The category editor moves onto the restyled sheet. Then the redesign gets its
milestone check: the full browser matrix once, and an `impeccable`
critique/audit of the shipped screens.

**Blocked by:** 02 (Home), 03 (Wallet page and the `/manage` split), 04 (＋ capture), 05 (Transactions filter sheet and chips), 06 (Reports rename and redirect)

**Status:** done

**Out of scope:** fixing what the critique finds (each material finding
becomes its own follow-up ticket in this directory); the DESIGN.md rewrite
(08).

- [x] Home's title bar shows a 32px Mist disc with the Account email's first letter, uppercased, labelled for assistive technology.
- [x] The disc opens the sheet with the email in Caption, then Categories and Sign out rows; both work.
- [x] The stopgap account dropdown in the Wallets title bar on phone (added in 01) is removed.
- [x] Sign-in and sign-up land on Home, and a signed-in visit to either auth page redirects to Home (02 left them on Wallets while sign-out lived there on phone).
- [x] On desktop, the account dropdown lists Categories above Sign out.
- [x] The category picker still creates categories inline, icon included; it does not link to Categories (see 09).
- [x] The category editor opens in the restyled sheet on phone and as the dialog from 640px; its content and behaviour are unchanged.
- [x] The auth and category-management browser specs cover the avatar sheet, the dropdown's Categories entry, Sign out, and the editor sheet.
- [x] `pnpm run ci` is green.
- [x] The full three-project browser matrix (`phone-chromium`, `phone-webkit`, `desktop-chromium`) runs once, alone, and passes; any failure is fixed or filed.
- [x] An `impeccable` critique/audit of the shipped shell, Home, wallet page, Transactions and Reports runs against `../spec.md`, and each material finding is filed as a follow-up ticket in `issues/`, numbered after 10.

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

From 07's grilling (2026-09-24):

- Picker: inline create, icon included, meets the Categories-from-picker
  story; no link out, since it would drop the draft. Editing an existing
  category mid-entry is deferred to 09.
- The disc sits in Home's title bar on phone only; from 640px the header
  dropdown is the account control. Other tabs get no disc.
- The avatar sheet has a visually hidden "Account" title, the email in
  Caption, then hairline rows of at least 48px with the dropdown's icons.
  Sign out is neutral and reads "Signing out…" while pending.
- Sign-in, sign-up and a signed-in auth visit all land on Home; returning to
  the requested page after sign-in is 10.
- Matrix: request host execution of `pnpm run ci:e2e` once the code is done,
  with `pnpm run test:e2e` across all three projects as the fallback.
  Failures this ticket caused are fixed here; older ones are filed.
- Critique: after the matrix passes, at 360px and 1280px. Material means a
  spec or rule-amendment breach, an accessibility failure or a broken layout
  at either width; each gets its own ticket. Taste notes share one ticket.

Closed (2026-09-24):

- Built in 345eb86. `pnpm run ci` passes; the auth, category-management,
  shell and reports specs pass on `phone-chromium`.
- Matrix: `pnpm run ci:e2e` ran once, alone: 61 passed, 5 skipped, 0
  failed. Two older `phone-webkit` tests were flaky once each and passed on
  retry; the cause is outside this ticket and is filed as 11.
- Critique: dual-agent `impeccable` critique and audit at 360px and 1280px
  on seeded local data, 26/36 (Good). Material findings are 12–18; taste
  notes, including sub-44px phone targets, are collected in 19.
