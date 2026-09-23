# 01: Shell: tab bar, desktop header, title bar and standalone chrome

Read `../spec.md` first (Shell modules, Routes, Rule amendments).

**What to build:** Every signed-in screen sits in the new shell. On phone, a
bottom tab bar (Home · Transactions · ＋ · Wallets · Reports) sits in the
thumb zone and a title bar carries each screen's h1, its ‹ back on nested
routes and its actions. On desktop from 640px, a 56px header carries the
wordmark, the four destinations, a cobalt New transaction button and the
account dropdown, and each screen shows its title as an in-page h1 with its
actions beside it. Standalone launches behave like an installed app.

Screens declare their chrome through one small shell interface: title,
back target (if nested), title-bar actions, and whether the screen is a form
(which hides the tab bar). The shell owns no feature.

**Blocked by:** None (can start immediately)

**Status:** done

**Out of scope:** Home content (02); the wallet page (03); ＋ carrying an
origin or wallet (04), since in this ticket ＋ and New transaction just open
new transaction; the sheet restyle and filter sheet (05); the `/reports`
route (06), so the Reports tab links to `/dashboard` for now; the avatar sheet
(07), so Home's title-bar avatar isn't needed yet. The Home tab links to `/`,
which still redirects to Wallets until 02.

- [x] Below 640px the tab bar is fixed to the bottom: top hairline, Paper at 80% with backdrop blur, 56px plus the bottom safe area, exposed as a labelled navigation landmark.
- [x] Each tab except ＋ is a Lucide icon (stroke 1.75) over a Label-size word, Graphite when inactive and Ink when current (`aria-current="page"`), with no pill, underline or cobalt.
- [x] ＋ is a 48px cobalt circle with "New" beneath it and opens new transaction.
- [x] The tab bar is hidden on new transaction, edit, refund, new wallet, wallet management, sign-in and sign-up, and shown on transaction detail. Pages reserve bottom padding so nothing hides behind it.
- [x] Below 640px the old app header is gone; the title bar shows the h1 on the left, ‹ back (with an `aria-label`) on nested routes, and actions on the right; it clears the top safe area, scrolls with the page and gains a bottom hairline only once scrolled; no wordmark.
- [x] Back goes to the logical parent, not browser history: transaction detail → Transactions, edit and refund → that transaction's detail, wallet management → Wallets (03 inserts the wallet page).
- [x] Title-bar actions: Wallets → New wallet as an outline button; Categories → New category as an outline button; forms → Cancel. Existing actions of other screens move into their title bars unchanged.
- [x] From 640px the header is 56px with a bottom hairline in the 672px column: wordmark, then Home · Transactions · Wallets · Reports capsule links, then a cobalt `lg` New transaction button and the account dropdown on the right; the tab bar is hidden.
- [x] `theme-color` is Paper, the iOS status-bar style is `default`, and `overscroll-behavior-y: none` stops pull-to-refresh.
- [x] Each tab keeps its scroll position when you switch away and back.
- [x] The unused `shadow-2xl` submenu style is removed from the dropdown-menu primitive.
- [x] The shell browser spec covers the tab bar on phone (items, current tab, hidden on a form and on sign-in), the desktop header from 640px, a back target, and scroll position kept across tabs. Other specs that located the old header nav are updated to the new navigation.

**Verify:** `pnpm run ci`, then the touched specs alone on `phone-chromium`. Resource limits in `CLAUDE.md` apply.

## Comments

Implemented on 2026-09-23. `pnpm run ci` passed, and the whole
`phone-chromium` project passed (the build-only PWA worker specs skip under
the dev server). Decisions made during the build, for review:

- The phone title bar is `sticky`: it stays at the top and gains its hairline
  once the page scrolls. "Scrolls with the page" and "hairline only once
  scrolled" cannot both hold for a bar that leaves the screen, so this took
  the reading where the hairline is ever seen.
- The chrome interface is a route's `staticData: { form: true }` (hides the tab
  bar before the screen renders) plus `<TitleBar title back actions>`.
- Forms carry Cancel in the title bar at every width, so the Save bar's
  phone-only ghost Cancel was removed (the form brief's "header with Cancel").
- Until 07: the account dropdown sits in the Wallets title bar on phone so
  sign-out stays reachable, and the dropdown gains Categories above Sign out
  because the old header's Categories link was the only way in. 07 moves the
  phone entry to Home's avatar sheet.
- The account trigger is the initial disc alone at every width; with the
  email, the 640px header overflowed its column.
- Transactions' Record button is now outline (One Cobalt: ＋ and New
  transaction are the cobalt action); 05 removes it.
- The manifest `theme_color` is Paper too, matching the meta tag.
- Scroll restoration is keyed by address, so any revisited address, not only a
  tab, returns to where it was left.
