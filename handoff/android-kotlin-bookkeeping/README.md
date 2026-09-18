# Android/Kotlin Bookkeeping Handoff Bundle

Move this entire directory into the fresh Android repository after scaffolding.
Start the next session with [`HANDOFF.md`](HANDOFF.md).

## Contents

- [`HANDOFF.md`](HANDOFF.md): confirmed project direction, portable tracking
  behavior, domain language, accepted ADRs, deferred decisions, documentation
  package, learning workflow, and recommended next steps.
- [`evidence/PRODUCT.md`](evidence/PRODUCT.md): previous product authority.
- [`evidence/CONTEXT.md`](evidence/CONTEXT.md): previous domain glossary.
- [`evidence/adr/0001-transaction-derived-balances.md`](evidence/adr/0001-transaction-derived-balances.md):
  platform-neutral balance-model decision.
- [`evidence/tracking/`](evidence/tracking/): the complete completed tracking
  milestone—specification, verification report, implementation tickets, transaction
  form brief, and icon/category technical notes.

## Authority rule

The evidence is frozen source material, not instructions for the new application.
Use it to rewrite the new repository's product, glossary, tracking specification,
acceptance scenarios, and ADRs. Preserve domain behavior and milestone intent;
discard the previous web architecture, server mechanisms, and visual design.
