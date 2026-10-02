---
version: 1
slug: "apps-web-src-routes-app-index-tsx"
primary_target: "apps/web/src/routes/_app/index.tsx"
related_targets: ["apps/web/src/core/shell","apps/web/src/shared/components","apps/web/src/styles/globals.css"]
---

# Surface brief: the app's visual world, defined on Home

Visitor mode: Operate. Platform: web (installed PWA), phone first at 360px,
desktop from 640px, light and dark following the system setting.

Replacement visual world for the whole SPA, set on Home and the shared shell
by ticket `.scratch/modern-fintech-redesign/issues/01-foundation-system-shell-and-home.md`
against the confirmed brief `.scratch/modern-fintech-redesign/design-brief.md`.
Later tickets (02–08) compose their screens from this system.

## Job and constraints

Seconds after paying, the owner checks how much there is, how the month is
going, and that the entry just saved is in the list. Behavior, routes, copy,
accessible names and `CONTEXT.md` vocabulary carry over unchanged. 44px phone
targets; type, sign and direction never by red or green alone; motion removed
under reduced motion; skeletons never show money.

## Direction contract

THESIS: Home is a bright banking-app front page: one deep Midnight hero card
holds the total, and everything else sits on white cards over a soft
iris-tinted ground. It refuses the flat statement of hairline rows and the
grey-only palette, and it refuses bank costume: no green, no borrowed marks.

OWN-WORLD: Iris (violet-blue) is the action and focus color; Midnight, a
deep inky indigo, is the hero surface; Mist-lavender ground in light,
near-black indigo in dark. 20px card corners, 14px control corners, a 48px Iris
circle for capture. Inter throughout; money in bold Inter with tabular digits,
the ฿ and satang stepped down on the hero. Category pictograms sit in
rounded-square tiles tinted from an eight-hue palette, child inheriting
parent.

STORY: The owner opens the app, reads the total on the hero card, sees
Income, Net expenses and Net for the month as one card, and finds the entry
they just saved at the top of Recent transactions, colored by its category.

FIRST VIEWPORT: Phone: title bar "Home" with the account disc right; the
Midnight hero card full column width, ~180px tall, "Total balance" label,
the figure at 36px bold white, "Across N wallets" beneath, the icon's bowl
and coin faint off its corner; This month card below, Income and Net
expenses side by side with their arrow tiles and Net beneath as the result,
the whole card linking to Reports; Recent transactions
starts above the tab bar. The Iris ＋ sits centered in the tab bar; desktop
puts New transaction in the header. From 1024px Home splits in two under
the header's width: hero and This month left, Recent transactions right.

FORM: Canon, pinned by the owner (PRODUCT.md Brand Commitments: clean modern
fintech at MAKE by KBank and K PLUS craft); the roll was overridden by the
pin. Seed key f40c71da. Raise kept from the declined developer-console
challenger: destructive actions stand apart from their neighbors by space,
never by color alone.

SIGNATURE: the just-saved row arrives with a 400ms rise-and-fade and keeps
a faint wash of its category tint; sheets rise 260ms and the segmented
indicator slides 200ms, both with exponential ease-out; hover colour fades
are 150ms; nothing else animates, and reduced motion removes all of it.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Recorded adaptations

- This month pairs Income and Net expenses in two columns with Net on its
  own row beneath: in and out read as a pair at a glance, and Net reads as
  their result. It replaces the row-list first written here.
- Dark mode keeps Midnight deep (lightness 0.28) rather than lifting it, so
  the hero stays inky against the near-black ground.
- Inter loads from Google Fonts, not self-hosted: an offline launch never
  renders the app (navigations are network-only and fall back to
  `offline.html`), so the platform sans cannot stand in for it. The offline
  page itself is exempt: it carries its own styles in the new palette and
  renders in the system sans. Self-hosting is a candidate for a later
  ticket.
- A transaction row's title wraps beside its figure rather than clamping,
  so the date, wallet and note beneath run the full width at 360px.

## Unresolved

- Chart component (ticket 05) uses the chart tokens defined here.
