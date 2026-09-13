---
name: Bookkeeping
description: A personal ledger in the clean modern fintech canon; one cobalt, one mono for money, hairlines instead of cards.
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
    height: "2.25rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 0.75rem"
    height: "2.25rem"
  button-ghost-hover:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
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
  nav-link-hover:
    backgroundColor: "{colors.mist}"
  segmented-track:
    backgroundColor: "{colors.mist}"
    rounded: "{rounded.pill}"
    padding: "0.25rem"
    height: "{spacing.control}"
  segment:
    backgroundColor: "transparent"
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 0.5rem"
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

Bookkeeping is a bank statement rendered as a web app: a light, near-white page, near-black Inter for words, JetBrains Mono for every figure, and one cobalt reserved for the thing you can do next. It is the clean modern fintech canon played straight (the standing brand commitment in PRODUCT.md), executed at the craft level of K PLUS, SCB Easy, and Apple Wallet rather than reinvented. Trust comes from exactness: currency symbol and satang are always present, numerals are tabular, and nothing on the page is decorative.

Density is calm and columnar. Pages sit in one centred column (672px for reading, 448px for forms) with 32px between blocks. Lists are flat: rows divided by hairlines, never wrapped in cards or tiles, and there is no stat-strip hero. The single display-size figure at the top of a list is the only large element on a screen. Controls are pills; everything that is not a control is a rectangle with a 14px corner or no corner at all.

Motion is feedback, never celebration. The system ships two moments: the segmented indicator slides (200ms ease-out) and a newly created row fades in (500ms). Both collapse under `prefers-reduced-motion`. Confirmed visual rejections from the direction contract and PRODUCT.md: the card grid of icon tiles, the stat-strip hero, green/red as the sole carrier of meaning, celebratory motion, and "account" in place of "wallet".

**Key Characteristics:**

- Light-only, near-white ground with near-black type; one cobalt accent for action, focus, selection, caret, and text selection.
- Two typefaces with hard roles: Inter for words, JetBrains Mono (tabular) for money.
- Display figures step the currency symbol and satang down to 0.6em so whole baht leads; row figures stay uniform to align.
- Pill controls (26px radius) on a page of hairlines; no card shells around list content.
- Lucide pictograms at one stroke weight (1.75) inside a 40px muted disc, always accompanied by a text label.
- Phone: full-bleed rows and a fixed, safe-area-aware Save bar; desktop: the same order in a centred column.

## Colors

A monochrome page of neutral greys with exactly one chromatic accent for action and one for error; every other colour is a lightness step of the same grey.

### Primary

- **Cobalt** (`{colors.cobalt}`): the primary button fill, the focus ring (`--ring` is the same value), the selected label in a segmented control, the caret, `accent-color` for native controls, and text selection at 18% (`color-mix(in oklch, var(--primary) 18%, transparent)`). It is never used for figures, headings, or decoration.
- **Cobalt Foreground** (`{colors.cobalt-foreground}`): text on cobalt.

### Neutral

- **Paper** (`{colors.paper}`): page, header, card and popover ground; the segmented indicator; the Save bar (at 80–95% with backdrop blur).
- **Ink** (`{colors.ink}`): body text, headings, wallet names, figures, current nav item.
- **Mist** (`{colors.mist}`): the segmented control track, the 40px type-icon disc, ghost/nav hover fill. The only filled neutral surface on the page.
- **Graphite** (`{colors.graphite}`): muted text: type labels, "Opened" dates, field descriptions, unselected segments, inactive nav items, and the stepped-down ฿ and satang in display figures.
- **Hairline** (`{colors.hairline}`): all borders and dividers (`--border` and `--input` share it). Inputs and the outline button fill with it at 30%; hover lifts to 50%.

### Semantic

- **Signal Red** (`{colors.signal-red}`): validation and destructive only. Invalid fields take a red border with a 3px ring at 20%; their label and error text turn red; the server error bar is red text on red at 5% with a red border at 30%.

### Named Rules

**The One Cobalt Rule.** Cobalt appears on a screen only as the primary action, the focus ring, or the selected state of a control. Two cobalt fills on one screen means one of them is wrong.

**The Red Means Wrong Rule.** Signal Red is validation and destruction. Transaction type, direction, or sign is never carried by red or green alone; it is carried by the word and the sign (−, +, →, ↩) with colour permitted only as reinforcement.

**The Grey Steps Rule.** Every neutral is a lightness step of the same achromatic grey (`oklch(L 0 0)`). Do not introduce tinted greys, warm whites, or a second surface tone.

## Typography

**Display Font:** Inter (with ui-sans-serif, system-ui) — used for headings as well; there is no separate display face.
**Body Font:** Inter
**Label/Mono Font:** JetBrains Mono (400/500/600/700 loaded) — every money figure, and only money figures.

**Character:** A neutral grotesque for language and a mono for arithmetic. Inter carries no personality of its own so the figures can; JetBrains Mono with tabular numerals and −0.01em tracking makes columns of baht line up to the satang. The `money` utility (`font-family: var(--font-mono); font-variant-numeric: tabular-nums; letter-spacing: -0.01em`) is the single source for this treatment.

### Hierarchy

- **Display Figure** (`{typography.display-figure}`; `{typography.display-figure-desktop}` from 640px): the one total at the top of a list. Line-height 1. In display mode the ฿ symbol and `.xx` satang are set at 0.6em, weight 500, in Graphite, so whole baht leads; the full string is also present visually hidden for screen readers.
- **Headline** (`{typography.headline}`): the page h1 ("Wallets", "New wallet"), semibold with tight tracking. One per page.
- **Title** (`{typography.title}`): section titles inside a block, such as the empty-state heading.
- **Row Figure** (`{typography.row-figure}`): a balance in a list row and the money input's value. Uniform size, no stepping, so right-aligned columns align.
- **Body** (`{typography.body}`): the primary line of a row (wallet name, weight 500) and native input text on phone. The wordmark "Bookkeeping" is Body at 600 with tight tracking.
- **Label** (`{typography.label}`): buttons, nav links, field labels, segment labels, the "THB" suffix. Weight 500, sentence case.
- **Caption** (`{typography.caption}`): muted secondary lines (type · Opened date), field descriptions, count line under the total, errors.

### Named Rules

**The Mono Is Money Rule.** JetBrains Mono is applied through the `money` utility and only to THB figures (and the amount input). Dates, counts, IDs, and labels stay in Inter.

**The Always Satang Rule.** A figure is always `฿12,000.00`: symbol, grouped whole baht, two decimals, true minus sign (−) for negatives. Never round, never drop the symbol, never localise away the decimals.

**The Step-Down Rule.** Only display-size figures step the symbol and satang to 0.6em Graphite. Row and input figures stay uniform.

## Layout

One centred column, full width on phone with 16px side padding, capped at 672px (`max-w-2xl`) for the header and list pages and 448px (`max-w-md`) for forms. Vertical rhythm is 32px (`gap-8`) between page blocks; 28px between fields in a form group; 12px between a label, its control, and its description; 16px inside a row between the icon disc, text, and figure. The app header is 56px tall with a bottom hairline; its content shares the 672px column.

On phone the list runs full-bleed: rows pull out by 16px (`-mx-4`) so hairlines span edge to edge, and each row restores 16px inner padding. From 640px (`sm`) rows sit inside the column with no horizontal padding, the title and primary action share one line, the secondary row line joins type and date with a middle dot, and the display figure grows from 36px to 48px. Each list row is at least 64px tall (`min-h-16`, 12px vertical padding).

Forms on phone reserve 160px bottom padding (`pb-40`) beneath the fields and mount Save in a fixed bar: full width, top hairline, Paper at 80% with backdrop blur (95% without), 12px top padding and `max(12px, env(safe-area-inset-bottom))` below, containing a 48px full-width primary button and a 44px full-width ghost Cancel. From 640px the bar becomes static and transparent, the ghost Cancel moves up beside the h1, and padding drops to 48px.

Breakpoints in use: `sm` 640px (all layout changes) and `md` 768px (native input text steps from 16px to 14px so phone keyboards do not zoom).

## Elevation & Depth

The system is flat and tonal. Depth is conveyed by hairlines (dividers, header rule, input strokes) and by a single filled neutral, Mist, for tracks and discs; there are no shadows on buttons, cards, or rows, and no card shells at all. Exactly one shadow exists in the build, on the segmented control's sliding indicator, where the white pill needs to read as sitting on the Mist track. The fixed Save bar separates from scrolling content with a hairline and backdrop blur rather than a shadow.

### Shadow Vocabulary

- **Indicator lift** (`box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 1px 6px rgba(0,0,0,0.06)`): the selected-segment indicator only. A real offset-plus-blur shadow, soft enough to be ambient.

### Named Rules

**The Hairline Rule.** Structure is drawn with 1px Hairline strokes, not with shadows, fills, or card shells. A list is rows separated by hairlines; a header is a bar with one hairline beneath.

**The One Lift Rule.** Shadows exist only where a control physically sits on a track (the segmented indicator). Do not add elevation to buttons, rows, inputs, or containers.

## Shapes

Two shape families. Controls are pills: buttons, inputs, nav links, the segmented track, its indicator and its segments all use the 26px radius (`--radius-4xl`, 2.6 × `--radius: 0.625rem`), which on 36–48px-tall controls renders as a full capsule. Non-interactive containers use a 14px corner (`--radius-xl`): the dashed-border empty state and the error bar. Icon discs are circles (40px). Text-only focus targets like the wordmark take a 6px corner (`--radius-sm`) only for the ring. Borders are always 1px Hairline; the empty state is the only dashed border. List rows have no radius, no border of their own, and no background; they are separated by hairlines.

The shadcn radius scale is present in full (`sm` 6px through `4xl` 26px) but the build reaches for only these four steps; use `xl` for any new box and `pill` for any new control rather than introducing intermediate corners.

## Components

Controls are tactile and quiet: capsules on a flat page, a 3px cobalt halo on focus, and a 1px press-down on click.

### Buttons

- **Shape:** capsule (`{rounded.pill}`), 1px transparent border with `background-clip: padding-box`, Label typography, icon 16px with 6px gap and reduced padding on the icon side (`data-icon="inline-start"`).
- **Primary** (`button-primary`): Cobalt fill, Cobalt Foreground text; the list page's Create wallet is size `lg` (40px, 16px side padding). The form Save is 48px tall, full width, Body-size text (`button-primary-save`). Hover: Cobalt at 80%. Active: `translateY(1px)`. Disabled: 50% opacity, pointer events off, label reads "Saving…" while in flight.
- **Outline** (`button-outline`): Hairline stroke, Hairline fill at 30% (50% on hover); used for Sign out in the header. 36px.
- **Ghost** (`button-ghost`): no fill; Mist on hover; used for Cancel (36px beside the h1 on desktop, 44px full width in the phone Save bar).
- **Focus:** border becomes Cobalt and a 3px ring of Cobalt at 50% appears; `focus-visible` only.
- **Destructive / link variants** exist in the primitive (red at 10%/20% fill; cobalt underlined text) but are not yet used on any surface.

### Inputs / Fields

- **Style:** capsule, 1px Hairline stroke, Hairline fill at 30%, Ink text, Graphite placeholder. Height 44px in this build (`h-11`; the primitive default is 36px), Body-size text on phone and Label-size from 768px.
- **Money input** (`input-money`): 48px tall, `money` utility at Row Figure size, `inputmode="decimal"`, a Graphite ฿ pinned 16px from the left (36px left padding) and a Graphite "THB" in Label weight pinned 16px from the right (64px right padding). Placeholder `0.00`.
- **Date input:** native `type="date"`, same capsule; a Caption description beneath echoes the chosen date in prose.
- **Field anatomy:** Label (Label typography) → control → optional Caption description in Graphite → error. 12px between each.
- **Focus:** Cobalt border plus 3px Cobalt ring at 50%.
- **Error:** the field's label turns Signal Red; the control takes a Signal Red border and a 3px Signal Red ring at 20%; the error message is Caption in Signal Red with `role="alert"`, rendered under the description, values preserved.
- **Server error bar** (`error-bar`): 14px-corner box, Signal Red text on Signal Red at 5%, 1px Signal Red border at 30%, 12px/16px padding, above the fields.

### Segmented Control (signature)

Base UI RadioGroup with radio semantics and arrow-key movement. Track: Mist capsule, 44px tall, 4px inner padding, equal-width grid columns. One indicator: a Paper capsule inset 4px, width `(100% − 8px) / n`, translated by `selectedIndex × 100%` over 200ms ease-out, carrying the Indicator lift shadow. Segments: Label typography, Graphite text, Cobalt text when checked (`data-checked`), colour transition 200ms; focus ring as buttons. Under `prefers-reduced-motion` both transitions are removed. The selected state is expressed by position and by text colour; the indicator is never coloured.

### Wallet Row (list item)

64px minimum, 16px gap, hairline between rows, no background or radius. Left: a 40px Mist circle with a Lucide pictogram (`size-5`, stroke 1.75, Ink) — Banknote for cash, Landmark for bank account, Smartphone for e-wallet. Middle: name in Body 500, truncated; beneath it a Caption line in Graphite with the type label, and from 640px a middle dot and "Opened 1 Sep 2026". Right: the balance as a Row Figure, right-aligned, non-shrinking. A row identified by `?created=<id>` arrives with a 500ms fade-in (`motion-safe` only).

### Display Figure

The total at the top of a list: Display Figure typography with the Step-Down treatment, followed 8px below by a Caption in Graphite ("Total across 3 wallets"). It is a paragraph, not a card, and it is the only large element on the page.

### Empty State

A 14px-corner box with a 1px dashed Hairline border, 24px padding (32px from 640px), items aligned to the start: a 40px Mist disc with the Lucide Wallet pictogram, a Title heading, a Caption paragraph capped at `max-w-prose`, and one primary `lg` button. When the empty state is shown, the header-level primary action is omitted so the page carries exactly one call to action.

### Navigation

A 56px header with a bottom hairline on Paper: the wordmark (Body 600, tight tracking, 6px focus corner), a nav list of capsule links (`nav-link`: Label typography, 12px/6px padding, Graphite; Ink when current via `aria-current="page"`; Mist on hover), and on the right the user's email in Caption Graphite (hidden below 640px) beside the outline Sign out button. No active underline, no icon, no fill on the current item.

## Do's and Don'ts

### Do

- **Do** set every THB figure with the `money` utility and the full `฿12,000.00` form (symbol, grouping, two decimals, true minus sign), right-aligned in lists.
- **Do** step only display-size figures: ฿ and satang at 0.6em, weight 500, Graphite; keep row and input figures uniform.
- **Do** use Cobalt for exactly one primary action per screen, plus focus rings and selected states; leave figures and headings in Ink.
- **Do** build lists as hairline-divided rows at 64px minimum, full-bleed on phone, inside the 672px column from 640px.
- **Do** make every control a capsule (26px radius) at 44–48px on phone, with the 3px Cobalt-at-50% focus ring.
- **Do** mount a form's primary action in the fixed safe-area Save bar on phone (48px button, hairline top, blurred Paper) and inline on desktop.
- **Do** pair every pictogram with a text label and draw it from Lucide at stroke 1.75, `size-5`, inside a 40px Mist disc.
- **Do** keep motion to feedback (indicator slide 200ms, arrival fade 500ms) and remove it under `prefers-reduced-motion`.

### Don't

- **Don't** wrap list content in cards, tiles, or a card grid; the list is the surface.
- **Don't** add a stat strip or more than one display-size figure to a screen.
- **Don't** carry transaction type, sign, or direction by green/red alone; Signal Red is for validation and destructive actions only.
- **Don't** put shadows on buttons, inputs, rows, or containers; the segmented indicator's lift is the only shadow.
- **Don't** introduce tinted or warm neutrals, a second accent, or a dark theme; the build is light-only.
- **Don't** set dates, counts, or labels in JetBrains Mono, or money in Inter.
- **Don't** use celebratory motion, confetti, or animated counters on save.
