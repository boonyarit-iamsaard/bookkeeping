# 19: Polish notes from the redesign critique

Read `../spec.md` first.

**What to build:** Nothing yet. These are the taste-level notes from 07's
milestone critique, kept together so they can be triaged as a set. Each
becomes its own ticket only if it is taken up.

**Blocked by:** None (can start immediately)

**Status:** needs-triage

**Out of scope:** the material findings, filed as 12–18.

- [ ] Phone touch targets under 44px: back ‹ is 40×40 (`apps/web/src/core/shell/title-bar.tsx:16`); Manage is 36px tall; Filter and New wallet are 40px; chips are 36px (`min-h-9`); Apply and Clear filters are 40px. They pass WCAG 2.5.8 (24px) but miss the 44px thumb target the rest of the phone UI keeps, and they sit at the top of the screen. Title-bar actions come in three heights (36, 40, 44px).
- [ ] Choosing a report month applies at once, but the balance date waits for "Update report".
- [ ] Home says "Across 4 wallets"; Wallets says "Total across 4 wallets".
- [ ] Sheets have no visible ✕; dismissal relies on the scrim or Escape. The grab handle suggests a drag that does not exist.
- [ ] The ＋ tab sits right of centre on phone (centre 197px against 180px), because "Transactions" is the widest label.
- [ ] On desktop Home, both the wordmark and the Home link carry `aria-current`.
- [ ] A wallet page's document title is "Wallet", not the wallet's name.
- [ ] Filter sheet labels mix styles: "Filter wallet" and "Filter category" beside "Type" and "From date".
- [ ] "Selected date" in Reports' wallet rows is vague; the date itself would say more.
- [ ] The "Recorded … · Bangkok" line wraps unevenly at 360px.
- [ ] Phone history rows are four Graphite lines at similar weight (98–138px tall), so nothing inside a row leads.
- [ ] The desktop account trigger shows only the initial; `DESIGN.md` described the email beside it from 640px (08 records what shipped).
- [ ] Inter covers 71–90% of text on every page (detector's overused-font rule); a direction question, not a defect.

## Comments

From 07's milestone critique (2026-09-24): dual-agent run, design review
plus detector at 360px and 1280px against the seeded local data.
