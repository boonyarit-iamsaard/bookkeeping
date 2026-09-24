---
name: Bookkeeping
description: A phone-first personal ledger; one cobalt action, one mono for money, hairlines instead of cards.
colors:
  cobalt: "oklch(0.52 0.2 262)"
  cobalt-foreground: "oklch(0.985 0 0)"
  paper: "oklch(1 0 0)"
  ink: "oklch(0.145 0 0)"
  mist: "oklch(0.97 0 0)"
  graphite: "oklch(0.556 0 0)"
  hairline: "oklch(0.922 0 0)"
  signal-red: "oklch(0.577 0.245 27.325)"
typography:
  display-figure:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "2.25rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
  display-figure-desktop:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "3rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
  row-figure:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.556
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.556
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: "normal"
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "0.375rem"
  xl: "0.875rem"
  pill: "1.625rem"
  full: "9999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "6": "1.5rem"
  "7": "1.75rem"
  "8": "2rem"
  header: "3.5rem"
  row: "4rem"
  control: "2.75rem"
  control-lg: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.cobalt-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 1rem"
    height: "2.5rem"
  button-primary-hover:
    backgroundColor: "oklch(0.52 0.2 262 / 80%)"
    textColor: "{colors.cobalt-foreground}"
  button-primary-save:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.cobalt-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 1rem"
    height: "{spacing.control-lg}"
    width: "100%"
  button-outline:
    backgroundColor: "oklch(0.922 0 0 / 30%)"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 0.75rem"
    height: "{spacing.control}"
  button-destructive:
    backgroundColor: "oklch(0.577 0.245 27.325 / 10%)"
    textColor: "{colors.signal-red}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 0.75rem"
    height: "{spacing.control}"
  button-destructive-hover:
    backgroundColor: "oklch(0.577 0.245 27.325 / 20%)"
    textColor: "{colors.signal-red}"
  input:
    backgroundColor: "oklch(0.922 0 0 / 30%)"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.75rem"
    height: "{spacing.control}"
  input-money:
    backgroundColor: "oklch(0.922 0 0 / 30%)"
    textColor: "{colors.ink}"
    typography: "{typography.row-figure}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 4rem 0.25rem 2.25rem"
    height: "{spacing.control-lg}"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.375rem 0.75rem"
  nav-link-current:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
  segmented-track:
    backgroundColor: "{colors.mist}"
    rounded: "{rounded.pill}"
    padding: "0.25rem"
    height: "{spacing.control}"
  segment-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.cobalt}"
  type-disc:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: "2.5rem"
  wallet-row:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "0.75rem 1rem"
    height: "{spacing.row}"
  empty-state:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
  error-bar:
    backgroundColor: "oklch(0.577 0.245 27.325 / 5%)"
    textColor: "{colors.signal-red}"
    typography: "{typography.caption}"
    rounded: "{rounded.xl}"
    padding: "0.75rem 1rem"
---

# Design System: Bookkeeping

## Overview

**Creative North Star: "The Statement of Holdings"**

Bookkeeping is a bank statement rendered as a phone-first web app: Paper behind near-black Inter, JetBrains Mono for every money figure, and one Cobalt action that is easy to reach after paying. It plays the clean modern fintech canon straight. Trust comes from exact money, quiet hierarchy, predictable controls, and motion used only to explain a state change.

Density is calm and columnar. Home answers the daily questions in one pass; deeper screens keep the same flat rows, hairlines, and narrow reading order. Controls are capsules, content is not boxed into cards, and the single display-size figure leads whenever a balance is the subject.

**Key Characteristics:**

- Light-only Paper and achromatic greys with one Cobalt accent and Signal Red for validation or destruction.
- Inter for language; JetBrains Mono with tabular numerals for THB and only THB.
- Flat, hairline-divided rows; one display figure; capsules for controls.
- A phone shell built around the title bar and bottom tab bar, with the desktop header taking over from 640px.
- Lucide pictograms at stroke 1.75, paired with words except for universally understood, accessibly named controls.
- Exactly three motion moments: segmented indicator, arriving row, and sheet.

## Colors

One chromatic action color, one destructive color, and neutral lightness steps keep attention on the ledger rather than its chrome.

### Primary

- **Cobalt** (`{colors.cobalt}`): the screen's primary action, focus rings, caret, text selection, and selected control states.
- **Cobalt Foreground** (`{colors.cobalt-foreground}`): text and glyphs on Cobalt.

### Neutral

- **Paper** (`{colors.paper}`): page, sheet, dialog, popover, header, and tab-bar ground.
- **Ink** (`{colors.ink}`): headings, body copy, figures, the current navigation item, and the full first line of a transaction row.
- **Mist** (`{colors.mist}`): quiet hover states, segmented tracks, and pictogram discs.
- **Graphite** (`{colors.graphite}`): captions, metadata, placeholders, and inactive navigation.
- **Hairline** (`{colors.hairline}`): borders and row dividers; inputs and outline controls use it at 30% and 50% opacity.

### Semantic

- **Signal Red** (`{colors.signal-red}`): validation and destructive actions. Destructive buttons use 10% Signal Red fill, 20% on hover, Signal Red text, and a 20% focus ring.

### Named Rules

**The One Cobalt Rule.** A screen has one Cobalt action. Selected states are separate: segment text, the chosen date or month, and a Select check may also be Cobalt. When the phone tab bar is present, its 48px ＋ is the action and page-level creates are outline buttons. When the tab bar is hidden, Save is the action. On desktop, New transaction in the header is the action. An empty state may use its own primary when it is the screen's sole next step.

**The Red Means Wrong Rule.** Signal Red means validation or destruction. Transaction type, direction, and sign use words and symbols rather than red or green alone.

**The Grey Steps Rule.** Every neutral is an achromatic OKLCH lightness step. Do not introduce tinted greys, warm whites, or a second accent.

## Typography

**Display Font:** Inter (with `ui-sans-serif`, `system-ui`) for headings and language.

**Body Font:** Inter.

**Money Font:** JetBrains Mono (with `ui-monospace`, `monospace`).

The neutral grotesque lets the arithmetic lead. JetBrains Mono is reserved for exact THB figures, with tabular numerals and tight tracking so columns reconcile visually.

### Hierarchy

- **Display Figure** (`{typography.display-figure}`, growing to `{typography.display-figure-desktop}` from 640px): the one balance or total that leads a screen. Its ฿ and satang step down to 0.6em, weight 500, in Graphite.
- **Headline** (`{typography.headline}`): one screen title in the phone title bar or desktop content row.
- **Title** (`{typography.title}`): section and sheet titles.
- **Row Figure** (`{typography.row-figure}`): list balances, report values, and the money input; the whole figure remains one size.
- **Body** (`{typography.body}`): primary row text and input values.
- **Label** (`{typography.label}`): buttons, navigation, fields, segments, and compact actions.
- **Caption** (`{typography.caption}`): metadata, descriptions, empty copy, errors, and wallet type or Archived status.

### Named Rules

**The Mono Is Money Rule.** The `money` treatment belongs only to THB figures and the amount input. Dates, counts, IDs, and labels remain Inter.

**The Always Satang Rule.** A figure is always `฿12,000.00`: symbol, grouped whole baht, two decimals, and a true minus sign for negatives.

**The Step-Down Rule.** Only display-size figures step down the symbol and satang. Row and input figures remain uniform.

## Layout

Content uses one centred column with 16px phone gutters: 672px for Home, lists, wallet detail, and reports; 448px for forms and management. Blocks are separated by 32px. Rows are at least 64px, with 16px between their disc, text, and figure. On phone, row dividers run full bleed while content restores the gutter.

From 640px, the 56px desktop header appears and content begins 32px below it. Below 640px, each screen begins with a sticky title bar that clears the status-area safe inset, gains a bottom hairline only after scroll, and gives every back or title action a 44px target. Form screens reserve space for the fixed safe-area Save bar and hide the tab bar.

The phone tab bar is fixed above the home indicator: 56px plus the bottom safe area, a top hairline, translucent Paper, and backdrop blur. Home and Transactions occupy one equal half, Wallets and Reports the other, with natural-width tabs inside each half and the ＋ exactly centred between them. Current is Ink; inactive is Graphite. There is no selected pill, underline, or accent fill.

**The Phone Reach Rule.** High-reach phone controls use a 44px target: back and title-bar actions, filter chips, and the filter sheet's Apply and Clear actions. The central ＋ and form Save are 48px. Other shipped controls range from 36px to 48px.

## Elevation & Depth

The system is flat by default. Hairlines establish structure, while exactly two lifted patterns establish temporary depth: the Paper segmented indicator uses a small close shadow, and floating Select, date/month picker, and account-menu popovers use a soft offset shadow. Sheets and dialogs use a 40% Ink scrim instead of a shadow.

### Shadow Vocabulary

- **Indicator lift:** `0 1px 2px rgb(0 0 0 / 8%), 0 1px 6px rgb(0 0 0 / 6%)` for the selected capsule inside a segmented track.
- **Popover lift:** `0 2px 4px rgb(0 0 0 / 4%), 0 8px 24px rgb(0 0 0 / 8%)` for floating value and account menus.

### Named Rules

**The Two Lifts Rule.** Only the segmented indicator and floating popovers cast shadows. Sheets use their scrim; buttons, inputs, rows, tab bars, and content containers remain flat.

## Shapes

Controls use a 26px capsule radius or a full circle. Floating surfaces, empty states, sheets, and dialogs use restrained 14px corners; a phone sheet rounds only its top corners. Rows and page regions have no container radius. Structure is a 1px Hairline, and empty states alone use a dashed border.

Pictogram discs are 40px circles in Mist. The Home account disc is 32px; the desktop account disc is 28px inside a 36px outline trigger. Lucide glyphs use stroke 1.75.

## Components

### Buttons

- **Primary:** Cobalt fill, Cobalt Foreground label, capsule shape. The empty-state primary is 40px, high-reach phone actions are 44px, and form Save is full-width and 48px.
- **Outline:** Hairline border with a 30% Hairline fill, rising to 50% on hover. It carries phone page actions while the tab bar owns Cobalt.
- **Ghost:** transparent, with Mist on hover; used for quiet alternatives such as Cancel.
- **Destructive:** 10% Signal Red fill and Signal Red text, becoming 20% on hover. It is used for wallet deletion, category removal, and transaction deletion.
- **Focus and pending:** a 3px Cobalt-at-50% focus-visible ring; destructive focus uses Signal Red at 20%. Disabled or pending controls are 50% opaque and keep their changing label visible.

### Inputs and Pickers

Inputs are 44px capsules with a Hairline border and 30% Hairline fill. Focus changes the border to Cobalt and adds a 3px Cobalt-at-50% ring. Invalid fields switch the label, border, and message to Signal Red and add a 20% red ring without clearing the entered value.

The money input is 48px and pins ฿ at the left and THB at the right. Date and month pickers use the same 44px trigger, a Graphite leading pictogram, and a floating Paper calendar with the Popover lift. Reports applies both month and balance date immediately on selection.

### Segmented Control

A 44px Mist capsule contains one inset Paper indicator. The indicator slides 200ms ease-out; the checked label is Cobalt and the others Graphite. Base UI radio semantics provide arrow-key movement. Reduced motion removes both transitions.

### Navigation

On phone, the tab bar exposes Home, Transactions, New, Wallets, and Reports as primary navigation. Every destination icon keeps its word; New is a 48px Cobalt circle over the label. The title bar labels the screen, places actions on the right, and uses an accessibly named ‹ to the logical parent on nested screens.

On desktop, the 56px header contains the Bookkeeping wordmark; Home, Transactions, Wallets, and Reports; the Cobalt New transaction action; and an account trigger showing only the initial. Its floating menu names the signed-in email, then Categories and Sign out.

On phone Home, a 32px initial disc opens the Account sheet with the email, Categories, and Sign out. Categories is not a tab.

### Sheets and Dialogs

A task inside a task opens as a bottom sheet on phone and a centred, content-height dialog from 640px. It is capped at 85dvh, scrolls internally, clears the home indicator, traps focus, closes on Escape or scrim activation, and returns focus to its trigger. The shared header has a title, optional caption or leading action, and a 44px accessibly named ✕. The delete alert deliberately has no sheet header or close button. Sheets do not show a grab handle.

Phone sheets slide 200ms ease-out while the scrim fades; desktop dialogs fade. Reduced motion removes those transitions.

### Home

Home is the signed-in root. With wallets, it shows the total across all wallets as the one display figure with “Across N wallets,” a divided This month block for Income, Net expenses, and Net that links to Reports, then the ten most recent transaction rows and All transactions →. With no wallets, only the create-wallet empty state appears. With wallets but no transactions, Recent transactions says “No transactions yet” and all month figures show `฿0.00`. Loading uses neutral skeletons, never sample money.

### Wallet Row and Wallet Page

A wallet row is a flat 64px minimum line: 40px type disc, name, Caption metadata, and right-aligned Row Figure. The caption begins with the type and adds Archived when needed (`Cash · Archived`); the opened date follows on desktop. The row opens the wallet page.

The wallet page leads with the current balance as its single display figure, repeats the same type/Archived caption, and lists that wallet's transactions. Its title-bar Manage action is outline. An arriving wallet or transaction row fades in for 500ms unless reduced motion is requested.

### Transaction Row and Filters

Transaction rows use the same flat 64px-minimum structure. The Ink first line combines the transaction type and category; the financial date and wallet metadata sit below in Graphite. History rows do not show recording time. Type words, signs, and arrows carry meaning; amount color is not the only signal.

Transactions opens filters in a sheet. Active filters appear as removable 44px outline chips beneath the title, and each chip removes only its own URL value. Apply and Clear are neutral. Invalid URL values stay visible and editable.

### Display Figure and Empty State

The display figure is a paragraph, never a card, followed by an 8px-spaced Caption. It is the only display-size element on its screen.

An empty state is a 14px dashed Hairline box with 24px phone padding, a Mist pictogram disc, Title, Caption, and one primary action. That sole primary is the One Cobalt empty-state exception.

## Do's and Don'ts

### Do

- **Do** render every THB figure with the `money` treatment and the full `฿12,000.00` form, right-aligned in lists.
- **Do** keep one Cobalt action per screen, treating selected control states and the sole empty-state action as the documented exceptions.
- **Do** use 44px for high-reach phone controls and every action sharing a title bar; use 48px for the central ＋ and form Save.
- **Do** build lists as full-bleed phone rows separated by Hairlines, inside the 672px column from 640px.
- **Do** use the two lifts only for the segmented indicator and floating popovers; use a scrim for sheets.
- **Do** keep motion to the indicator slide, arrival fade, and sheet slide, and remove all three for reduced motion.
- **Do** pair pictograms with text; an icon-only control requires an accessible name and a universal glyph such as ‹, ✕, or a calendar arrow.
- **Do** use the destructive variant for wallet, category, and transaction removal.

### Don't

- **Don't** wrap list content in cards, tiles, or a card grid; the list is the surface.
- **Don't** add a stat strip or more than one display-size figure to a screen.
- **Don't** use a second Cobalt page action where the phone ＋, form Save, or desktop New transaction already owns the action.
- **Don't** carry transaction type, sign, or direction by red or green alone.
- **Don't** put shadows on buttons, inputs, rows, sheets, tab bars, or content containers.
- **Don't** introduce tinted neutrals, a second accent, or a dark theme; the shipped product is light-only.
- **Don't** set dates, counts, or labels in JetBrains Mono, or money in Inter.
- **Don't** add grab handles to sheets or icon-only navigation labels.
- **Don't** add motion beyond the three feedback moments or animate them under reduced motion.
