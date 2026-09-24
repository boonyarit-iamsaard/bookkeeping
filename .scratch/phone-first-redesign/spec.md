# Phone-first redesign of the SPA shell and Home

Status: ready-for-agent

Decisions confirmed on 2026-09-23 by grilling `DESIGN.md`; this spec is the
full decision record. This is the redesign the SPA port
deferred (`.scratch/spa-client/spec.md`, Non-goals). Inputs: `DESIGN.md`,
`PRODUCT.md`, `CONTEXT.md`, `docs/adr/0006-vite-tanstack-router-spa-client.md`,
and `.scratch/tracking/design-brief-transaction-form.md`, which is still the
confirmed direction for the entry form and is not reopened here.

## Problem Statement

The app is used on the phone, one-handed, seconds after paying, but the SPA is
a faithful copy of a desktop-shaped web app. Navigation is a row of small
links in a top header that the thumb cannot reach. Capturing a transaction
means finding the Record button, which only appears on a non-empty history
page. Opening the app lands on the wallet list, so seeing "how much do I have,
how is this month going, what did I just record" takes three screens. Wallet
rows open a management form instead of that wallet's money. Filters take up
the top of the history page. Monthly totals sit behind a "Monthly summary &
balances" button. In standalone mode the page can rubber-band and pull to
refresh, and switching screens loses your scroll position.

## Solution

A phone-first shell over the same visual system: tokens, type, pills,
hairlines and the named rules stay; structure and ergonomics change.

- A **Home** screen at `/` answers the three questions at once: the total
  across wallets, this month's Income, Net expenses and Net, and the ten most
  recent transactions.
- A **bottom tab bar** on phone (Home · Transactions · ＋ · Wallets · Reports),
  with capture as the centre ＋. On desktop the same destinations sit in the
  56px top header beside a cobalt **New transaction** button.
- A **title bar** on phone that carries the page title, a ‹ back on nested
  screens, and the screen's actions.
- **Sheets** for filters, the account menu and the category editor.
- Capture returns to the screen it started from and pre-fills the wallet
  when started from a wallet's page.
- A wallet's page shows its balance and its transactions; management moves
  one level down.
- `/dashboard` becomes **Reports** at `/reports`.
- Standalone chrome that behaves like an installed app.

After the build, `DESIGN.md` is rewritten from what shipped.

## User Stories

### Home

1. As the account holder, I want the app to open on Home, so that my total, this month and my latest entries are the first thing I see.
2. As the account holder, I want my total across wallets shown as the one display figure on Home, so that I know how much I have at a glance.
3. As the account holder, I want "Across N wallets" beneath the total, so that I know what the figure covers.
4. As the account holder, I want this month's Income, Net expenses and Net as three divided rows, so that I can see how the month is going without opening Reports.
5. As the account holder, I want the month block to open Reports for this month, so that I can drill into the detail in one tap.
6. As the account holder, I want my ten most recent transactions on Home in the same row form as history, so that I can confirm what I just recorded.
7. As the account holder, I want "All transactions →" beneath the recent list, so that I can continue into full history.
8. As a new account holder with no wallets, I want Home to show only the create-wallet empty state, so that my first step is obvious.
9. As an account holder with wallets but no transactions, I want Home to say "No transactions yet" and show ฿0.00 for the month, so that an empty ledger reads as empty rather than broken.
10. As the account holder, I want neutral skeletons while Home loads, so that I never see sample money that could be mistaken for mine.
11. As the account holder, I want to tap a recent transaction to open its detail, so that Home is a working entry point.

### Navigation (phone)

1. As a phone user, I want a bottom tab bar with Home, Transactions, ＋, Wallets and Reports, so that every main destination is within thumb reach.
2. As a phone user, I want each tab to show an icon above its word, so that I never have to guess what an icon means.
3. As a phone user, I want the current tab shown in Ink and the others in Graphite, with no pill, underline or colour, so that the bar stays quiet and in the house style.
4. As a phone user, I want the tab bar to sit above the home indicator, so that iOS gestures don't collide with it.
5. As a phone user, I want the tab bar hidden on forms and on the sign-in and sign-up pages, so that the Save bar owns the thumb zone there.
6. As a phone user, I want the tab bar to stay on detail screens, so that I can leave a detail view in one tap.
7. As a phone user, I want each tab to keep its scroll position, so that switching tabs doesn't lose my place.
8. As a phone user, I want a title bar with the page title on the left and the page's actions on the right, so that every screen is labelled and its actions are in a predictable place.
9. As a phone user, I want ‹ back on nested screens (detail, edit, refund, manage), so that I can go up a level without the browser's back button.
10. As a phone user, I want back to go to the logical parent, so that it still works when I arrive by a deep link.
11. As a phone user, I want the title bar to scroll with the page and gain a hairline only once I've scrolled, so that it takes no space at rest.
12. As a phone user, I want the title bar to clear the status bar in standalone mode, so that the title is never under the clock.
13. As a phone user, I want no wordmark in the title bar, so that the space goes to the page title and its actions.

### Navigation (desktop)

1. As a desktop user, I want a 56px top header with the wordmark, Home, Transactions, Wallets and Reports links, a New transaction button and my account menu, so that the same destinations are one click away.
2. As a desktop user, I want the page title shown as an in-page heading with its actions beside it, so that the layout matches phone without a phone title bar.
3. As a desktop user, I want the tab bar hidden from 640px, so that I never see two navigations at once.

### Capture

1. As the account holder, I want ＋ as a 48px cobalt circle labelled "New" in the centre of the tab bar, so that capture is the most reachable action in the app.
2. As the account holder, I want saving a new transaction to return me to the screen I started from, so that capture doesn't pull me away from what I was doing.
3. As the account holder, I want the new row to fade in where I return, so that I can see it was recorded.
4. As the account holder, I want Cancel to return me to the screen I started from as well, so that abandoning an entry doesn't lose my place.
5. As the account holder, I want ＋ from a wallet's page to pre-fill that wallet, so that recording a spend from that wallet needs no wallet change.
6. As the account holder, I want ＋ from an archived wallet's page to fall back to my last-used wallet, so that I'm never stopped by a wallet that can't take new entries.
7. As the account holder, I want ＋ from a filtered history not to pre-fill from the filters, so that a filter I set to look at something doesn't quietly change what I record.
8. As a returning account holder, I want ＋ from Home, Transactions and Reports to default to my last-used wallet as today, so that the fast path is unchanged.
9. As a desktop user, I want the New transaction button in the header to behave like ＋, so that both layouts capture the same way.

### Wallets

1. As the account holder, I want tapping a wallet to open that wallet's page with its current balance as the display figure, so that I can see what one wallet holds.
2. As the account holder, I want a wallet's page to list that wallet's transactions, so that I can reconcile it against my bank or my cash.
3. As the account holder, I want Manage in the wallet page's title bar, so that corrections, archive and delete are one step away but not in the way.
4. As the account holder, I want wallet management at its own address below the wallet page, so that the management screen works as before and back leads to the wallet page.
5. As the account holder, I want New wallet as an outline title-bar button, so that ＋ stays the one cobalt action on the Wallets screen.
6. As an account holder with archived wallets, I want archived wallets to keep their figures and their Archived label on the list and on their pages, so that my totals still reconcile.

### Transactions

1. As a phone user, I want Filter in the Transactions title bar to open a sheet with the current filter fields and Apply and Clear, so that filters don't take up the top of history.
2. As a phone user, I want active filters shown as removable chips under the title, so that I can see and undo what narrows the list.
3. As the account holder, I want removing a chip to drop just that filter, so that I can widen the list one step at a time.
4. As the account holder, I want filters to stay in the address, so that a filtered history survives reload and can be bookmarked.
5. As the account holder, I want Transactions without its own Record and "Monthly summary & balances" buttons, so that ＋ and the Reports tab are the only ways in and the page leads with the list.
6. As the account holder, I want invalid filter values kept visible and editable, so that I can correct them instead of retyping.

### Reports

1. As the account holder, I want the monthly summary at `/reports` under the Reports tab, so that its name matches what it is.
2. As the account holder, I want old `/dashboard` links to land on Reports with their month and date kept, so that bookmarks keep working.
3. As the account holder, I want the month picker in the Reports title bar, so that changing month is where the title is.
4. As the account holder, I want the report's content and order unchanged, so that the figures I've learned to read stay where they were.

### Account menu and Categories

1. As a phone user, I want a 32px initial disc in Home's title bar that opens a sheet with my email, Categories and Sign out, so that the account actions are reachable without a tab.
2. As a desktop user, I want the header's account dropdown to include Categories, so that category management is reachable on desktop too.
3. As the account holder, I want to create a category, icon included, from the category picker as today, so that a missing category never stops an entry. Editing an existing category mid-entry is deferred to 09.
4. As the account holder, I want the category editor to open as a sheet on phone and a dialog on desktop, so that editing a category matches the other sheets.
5. As the account holder, I want New category as an outline title-bar button, so that the screen keeps one cobalt action.

### Sheets

1. As a phone user, I want sheets to slide up from the bottom with a grab handle over a dimmed page, so that I know I can dismiss them and what's behind them.
2. As a phone user, I want long sheets capped at 85% of the screen with their content scrolling inside, so that I can always see the page behind and close the sheet.
3. As a phone user, I want sheets to clear the home indicator, so that their last row is reachable.
4. As a desktop user, I want sheets shown as a centred dialog, so that they fit a wide window.
5. As a keyboard or screen-reader user, I want sheets to trap focus, close on Escape and return focus to what opened them, so that they behave like dialogs.

### Standalone and accessibility

1. As an installed-app user, I want the status bar to match the Paper page, so that the app looks native.
2. As an installed-app user, I want no rubber-band overscroll and no pull-to-refresh, so that a scroll never reloads the page.
3. As a user who prefers reduced motion, I want the indicator slide, the arrival fade and the sheet slide all switched off, so that nothing moves unexpectedly.
4. As a screen-reader user, I want every icon-only control to have a label, so that back, close and calendar arrows are announced.
5. As a screen-reader user, I want the tab bar exposed as navigation with the current tab marked, so that I know where I am.

## Implementation Decisions

### Scope rule

- Structure and phone ergonomics only. Colours, type, radii, spacing tokens,
  pills, hairlines and the named rules stay as they are, apart from the
  amendments below.
- No API change. Every read Home and the wallet page need already exists:
  wallet list (the total is summed in the client, as the wallet list does
  today), the monthly report, and the transaction list with a wallet filter
  and a limit.
- `db:push` policy is untouched; no schema change.

### Routes

- `/` renders **Home** inside the signed-in layout and replaces the redirect
  to `/wallets`. The manifest `start_url` stays `/`.
- `/reports` is the monthly summary, with the same `month` and `asOf` search
  as today. `/dashboard` redirects to `/reports`, keeping the query string.
- `/wallets/$id` is the **wallet page**: balance plus that wallet's history.
  `/wallets/$id/manage` is today's management screen, unchanged in content.
- Back targets are the logical parent, never browser history:
  transaction detail → Transactions; edit and refund → the transaction's
  detail; manage → the wallet page; wallet page → Wallets.
- Each tab keeps its scroll position (the router's scroll restoration).

### Shell modules

The shell owns layout chrome and no feature. Features supply their titles and
actions through a small interface: a screen declares its title, whether it is
nested (and its back target), its title-bar actions, and whether it is a form
(which hides the tab bar).

- **Tab bar (phone, below 640px):** fixed to the bottom, top hairline, Paper
  at 80% with backdrop blur (the Save bar's treatment), 56px plus the bottom
  safe area. Five items: Home, Transactions, ＋, Wallets, Reports. Each tab
  except ＋ is a Lucide icon at stroke 1.75 over a Label-size word, Graphite
  when inactive and Ink when current (`aria-current="page"`), with no pill,
  underline or cobalt. Rendered as a labelled navigation landmark. Hidden
  on: new transaction, edit transaction, refund, new wallet, manage wallet,
  sign-in and sign-up. Shown on detail screens. Pages reserve bottom padding
  for it.
- **＋ tab:** a 48px cobalt circle with the word "New" beneath it. It links to
  new transaction, carrying the origin screen and, only on a wallet page for
  an active wallet, that wallet.
- **Title bar (phone):** replaces the app header below 640px. Safe-area
  aware at the top. h1 on the left; ‹ back (icon-only with an `aria-label`)
  before it on nested routes; screen actions on the right. It scrolls with
  the page and shows a bottom hairline only once the page is scrolled. No
  wordmark.
- **Title-bar actions by screen:** Home → avatar disc; Transactions →
  Filter; Wallets → New wallet (outline); wallet page → Manage; Categories →
  New category (outline); Reports → month picker; forms → Cancel.
- **Desktop header (640px and up):** 56px, bottom hairline, in the 672px
  column: wordmark, then Home, Transactions, Wallets, Reports as capsule nav
  links, then on the right a cobalt `lg` **New transaction** button (same
  target as ＋) and the account dropdown. The phone title bar becomes an
  in-page h1 with the actions beside it.
- **Sheet:** one shared primitive. Paper, 14px top radius, a 4×36px Hairline
  grab handle, a scrim of Ink at 40%, no shadow. Bottom safe-area padding,
  capped at 85% of the viewport height with the content scrolling inside.
  Slides up in 200ms ease-out while the scrim fades. From 640px it is the
  centred, content-height dialog. Dialog semantics: focus trap, Escape to
  close, focus returned to the trigger. Used for the filter sheet, the avatar
  menu and the category editor.
- **Avatar menu:** a 32px Mist disc with the Account email's first letter,
  uppercased, in Home's title bar. It opens a sheet with the email in
  Caption, then Categories and Sign out rows. On desktop it is today's
  account dropdown with Categories added above Sign out.
- **Standalone chrome:** `theme-color` Paper; iOS status bar style `default`;
  `overscroll-behavior-y: none` on the page, so there is no pull-to-refresh.

### Capture

- The new-transaction screen accepts two optional search values: the
  **origin** (the in-app screen capture started from, including its search)
  and a **wallet** to pre-fill.
- The origin must be an internal path in this app; anything else falls back
  to Home. After a successful create, the screen navigates to the origin
  with `created=<id>`, and a row with that id arrives with the existing 500ms
  fade wherever it is listed (Home's recent list, Transactions, a wallet
  page). Cancel returns to the origin without `created`.
- Pre-fill wallet: use the passed wallet if it is an active wallet;
  otherwise use the **last-used wallet** (and if that is gone, the first
  active wallet, as today). History filters never pre-fill.
- These two decisions (origin resolution and default wallet) are pure
  functions, unit-tested.
- Edit and refund keep their current save and cancel behaviour.
- The entry form itself (fields, Transfer re-layout, validation, idempotency,
  Save bar) is unchanged; the confirmed transaction-form brief governs it.

### Home

- Top to bottom:
  1. The total across wallets as the one display figure (the same sum and
     the same wallets, archived included, as the Wallets screen), with
     "Across N wallets" in Caption.
  2. A **This month** block: three divided Row Figure rows, Income, Net
     expenses and Net, from the monthly report for the current Bangkok
     month. The whole block links to Reports for that month.
  3. **Recent transactions**: the latest 10 in the history-row form, then an
     "All transactions →" link.
- No wallets: only the existing empty state with Create wallet as the
  primary (the empty state's cobalt exception). ＋ still works and reaches
  the no-wallet state of the entry form.
- Wallets but no transactions: Recent shows the Caption "No transactions
  yet"; the month block shows ฿0.00 rows.
- Loading: neutral skeletons in the final layout. Never sample money.

### Wallet page and management

- The wallet page shows the wallet's current balance as the display figure
  (Step-Down treatment), its type and Archived state in Caption, then its
  transactions: history pre-filtered to this wallet, with the same rows and
  older-page link. Manage sits in the title bar.
- Wallet rows on the Wallets screen link to the wallet page.
- Wallet management (moved from `DESIGN.md`, unchanged): the narrow form
  column; the exact current balance and Archived state; opening correction,
  archive/unarchive and permanent deletion separated by hairlines. Opening
  correction is the single cobalt action; lifecycle controls are outlined
  and at least 48px tall. Deletion expands an explicit confirmation with a
  destructive button and Cancel. Errors are announced and form values stay
  intact. Management is a form screen, so the tab bar is hidden.
- Archived wallets keep their figures in the wallet list and its total. With
  no active wallets, transaction entry offers creation or wallet management
  for unarchiving. Wallet labels on existing transactions show Archived in
  list, detail and edit.

### Transactions

- Phone: Filter in the title bar opens the filter sheet with today's fields
  (inclusive From and To dates, wallet, category, type) and Apply and Clear,
  both neutral. Active filters show as removable chips under the title; each
  chip removes one filter from the address. This replaces the inline
  disclosure. From 640px the same sheet opens as a dialog.
- Filters stay GET values in the URL; invalid values stay in the controls,
  editable, with the validation message.
- The page drops its Record button and its "Monthly summary & balances"
  link; ＋ and the Reports tab replace them.
- History rows are unchanged (moved from `DESIGN.md`): divided rows; the
  financial date and the original Bangkok recording time on separate lines;
  type words and signs carry meaning; refunds link separately to the
  original expense; long amounts may wrap beneath the description instead
  of squeezing it.

### Reports

- "Reports" h1; the month picker moves to the title bar (beside the h1 on
  desktop). The balance-date control, content and order are unchanged.
- Report content (moved from `DESIGN.md`, unchanged): monthly income, gross
  expenses, refunds, net expenses and net as a divided definition list with
  right-aligned tabular THB figures, net at stronger weight; wallet rows
  show current and selected-date balances, stacked on phone and paired on
  desktop, with an overall row and Archived labels. Empty, loading and error
  states use text and neutral skeletons; loading never presents sample
  money. GET values stay in the URL, and invalid values keep their editable
  controls.

### Categories

- Reached from the avatar menu (phone) and the account dropdown (desktop);
  the category picker creates categories inline but does not link here. Not
  a tab.
- Category management (moved from `DESIGN.md`; only the button styling and
  sheet primitive change): both trees behind the Expense | Income segmented
  control, as hairline rows in the 672px column. Parents lead with the 40px
  disc and a Body 500 name; children sit beneath with a 32px disc, a ›
  marker and an 8px indent. A row's entry count appears in Caption on the
  right only when it has any. Every row is a button to the editor sheet:
  Name, the icon picker with recommendations and browse, one cobalt Save
  changes, then beneath a hairline the Remove section, which states the
  count and destination in prose before "Remove…" expands to a destructive
  confirm beside "Keep it". A parent with children says why it stays
  instead of showing a disabled control; Uncategorized shows a read-only
  name with its reason and no removal. New category (now outline, in the
  title bar) opens the same create form the transaction picker uses. After
  any change the sheet closes, the list re-reads from the server, and a
  status line under the title says what happened; after a removal that line
  takes focus.

### Rule amendments

These govern the build and are written into `DESIGN.md` at the rewrite.

- **One Cobalt:** one cobalt _action_ per screen. Selected states (segment
  text, the chosen day or month, the Select check) are a separate allowed
  use. Where the tab bar shows, ＋ is that action, so page-level creates (New
  wallet, New category) are outline title-bar buttons. The empty state's
  primary is the exception. Where the tab bar is hidden, Save is the action.
  On desktop, the header's New transaction button is the action.
- **One Lift → two lifts:** the segmented indicator, and floating popovers
  (Select, date and month picker, dropdown). Remove the unused `shadow-2xl`
  submenu style from the dropdown-menu primitive. Sheets get depth from the
  scrim, not a shadow.
- **Motion:** three feedback moments: the indicator slide, the arrival fade
  and the sheet slide. All three collapse under `prefers-reduced-motion`.
- **Pictogram + label:** icon-only controls are allowed only with an
  `aria-label` and a universal glyph (‹ back, ✕ close, calendar arrows). Tab
  icons always keep their word.
- **Destructive:** documented as in use (wallet delete, category remove,
  transaction delete), with its tokens added to `DESIGN.md`.
- **Header:** the old Navigation text (email beside an outline Sign out,
  icon-only Sign out on phone) was already wrong and is superseded by the
  desktop header, title bar and avatar menu above.

### Vocabulary

- **Account** (in `CONTEXT.md`) names the signed-in identity the avatar
  stands for. Home, Reports and the tab names are UI labels, not domain
  terms; don't add them to `CONTEXT.md` unless a later effort gives them
  domain meaning.

## Testing Decisions

- **What a good test is:** it drives the app the way the account holder
  does, through roles, labels and visible text, and asserts on what they
  see: where navigation lands, which figures show, which row arrives. It
  never asserts on class names, component structure or internal state.
  Viewport-specific assertions branch on the project's width, as the shell
  spec already does for the wordmark.
- **Primary seam: the SPA browser suite** (Playwright; projects
  `phone-chromium` at 360px and `desktop-chromium`; ADR 0007 dropped
  `phone-webkit`). Each ticket updates the specs its screens touch and
  runs them alone on `phone-chromium`. The CLAUDE.md resource limits apply:
  never alongside another browser run, Sonar, a production build or the
  unit and integration suites.
  - Shell spec: the tab bar on phone (five items, current tab marked, hidden
    on forms and auth), the desktop header from 640px, the title bar's back
    targets, scroll position kept across tabs.
  - A Home spec: total, month block and recent list with a fresh user's
    data; the no-wallet and no-transaction states; the month block linking
    to Reports.
  - Transaction-entry spec: ＋ from Home, Transactions and a wallet page
    returns there with the new row faded in; wallet pre-fill from an active
    wallet page and fallback from an archived one; no pre-fill from
    filtered history; Cancel returns to the origin.
  - Wallets and wallet-lifecycle specs: wallet row → wallet page → Manage;
    management flows at the new address.
  - History spec: filter sheet, chips, chip removal, invalid values kept.
  - Dashboard spec becomes the Reports spec: `/reports`, the `/dashboard`
    redirect keeping `month` and `asOf`, the month picker in the title bar.
  - Category-management and auth specs: the avatar sheet and dropdown reach
    Categories and Sign out; the category editor opens as a sheet.
  - PWA spec: standalone launch still lands on Home.
- **Secondary seam: unit tests** (Vitest, node environment, pure modules
  only, `*.unit.test.ts`) for the pure decisions: resolving a capture origin
  (internal paths accepted, anything else → Home), choosing the default
  wallet (passed active wallet → last-used → first active), and carrying the
  query string across the `/dashboard` redirect. Prior art:
  `wallet-options.unit.test.ts`, `history-schema.unit.test.ts`,
  `report-schema.unit.test.ts`.
- **No new seams:** no component-test harness (no jsdom or Testing
  Library), and no Hono contract tests, because the API does not change.
- **Gates:** `pnpm run ci` per ticket. After the avatar-menu ticket, run the
  full three-project browser matrix once (the milestone checkpoint the
  CLAUDE.md policy allows).

## Out of Scope

- Any change to the visual system beyond the rule amendments: no new
  colours, type, radii, dark theme or second accent.
- The entry form's internals, governed by the transaction-form brief.
- API, schema or domain changes. Any gap found becomes a ticket against
  `apps/server` with its own contract test.
- Offline capture, gestures (swipe to delete, swipe between tabs), haptics,
  pull-to-refresh, push notifications.
- Categories as a tab, a More tab, or a settings screen.
- Changing the Reports content or its order.
- Budgeting and forecasting screens.
- An impeccable shape pass or comp. The decisions are specified to the
  token, and the visual system is locked.
- Database migrations (the `db:push` rule stands).

## Further Notes

- **Order of tickets** (files in `issues/`, blockers in each): 01 shell
  (tab bar, desktop header, title bar, standalone chrome) · 02 Home ·
  03 wallet page and the `/manage` split · 04 ＋ return-to-origin and wallet
  pre-fill · 05 sheet restyle, Transactions filter sheet and chips ·
  06 Reports rename and redirect · 07 avatar sheet and the Categories entry,
  then the full three-project browser matrix and an `impeccable`
  critique/audit of the shipped screens · 08 `DESIGN.md` rewrite. 02, 03,
  05 and 06 can run in any order once 01 is done.
- **Design review:** `impeccable-finish-reviewer` is not used; it expects a
  comp-led build with a direction contract and comp-diff evidence that this
  code-led extension doesn't have. The `impeccable` critique/audit in
  ticket 07 replaces it, and its material findings become follow-up tickets.
- **DESIGN.md rewrite (ticket 08):** via `impeccable-documenter`, updating
  the existing file from the shipped build. Pass it this spec's Rule
  amendments section in place of a direction contract. `DESIGN.md` describes
  what exists, never the target, and the per-screen notes it carried now
  live in this spec.
- ADR 0006 is respected: the SPA, the generated client, TanStack Query and
  the PWA baseline are unchanged. No ADR is needed for this effort; the
  decisions are reversible UI structure.
