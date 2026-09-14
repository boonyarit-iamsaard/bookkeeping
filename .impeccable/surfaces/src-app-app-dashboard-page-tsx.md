---
version: 1
slug: "src-app-app-dashboard-page-tsx"
primary_target: "src/app/(app)/dashboard/page.tsx"
related_targets:
  - "src/app/(app)/transactions/page.tsx"
  - "src/features/transactions/components/financial-report.tsx"
  - "src/features/transactions/components/history-filters.tsx"
---

# Surface brief: history and financial summaries

Visitor mode: Operate. Platform: web, phone and desktop.
Scoped extension of the existing visual system, based on ticket 09 and the
approved tracking spec; no new visual-world decisions.

## Job and outcome

Investigate dated money movements with combined filters, review monthly
income and spending, and compare current holdings with selected-date
end-of-day balances. Product truth lives in `PRODUCT.md`, `CONTEXT.md` and
`.scratch/tracking/spec.md`.

## Interaction and layout

Preserve the light ground, cobalt action/focus vocabulary, existing Inter and
JetBrains Mono, 672px column and divided rows. Controls stack at 360px and
pair from 640px. Type labels, signs, transfer direction and an original-expense
link carry meaning without relying on color. Dates and Bangkok recording
times are distinct. Monthly totals are definition-list rows, with net stronger
in weight. Current and selected balances stack on phone and pair on desktop.

## States and verification

The native Filter history disclosure is collapsed in normal history and
opens for active filters. GET controls retain submitted values in the address. Invalid ranges and dates
show validation alongside editable controls. No-match history suggests wider
filters; an empty report explains the absence of monthly movements. No wallets
offers creation. Loading skeletons contain no financial figures; read failures
provide retry. Verify combined filter and report navigation, linked records,
keyboard access, and phone/desktop layouts alongside the integrated entry,
category, transfer, correction and refund workflows.
