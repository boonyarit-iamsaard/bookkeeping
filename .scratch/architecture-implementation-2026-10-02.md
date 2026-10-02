# Architecture candidates: implementation record

Status: implemented

Starting commit: `0394111b9131115edb7b779134ccd9fe0fe333a6`.
The user confirmed all three designs and authorized `/implement all` on
2026-10-02. The original [architecture review](architecture-review-2026-10-02.html)
is the source-review snapshot before implementation.

## Implemented scope

- [Reports read coordination](reports-read-coordination/design-notes.md):
  `report-reads.ts` owns the shared preload inventory, screen subscriptions,
  readiness, existing presentation derivations, and safe comparison placeholders.
  Valid reads awaiting data use the existing loading screen.
- [Category selection](category-selection/design-notes.md): the picker and
  capture use the same live catalog. Capture has one selection callback and no
  snapshot/manual append. Durable creation has explicit read recovery without
  another POST; abandoned creation cannot overwrite a later selection.
- [Selected Closing balance day](closing-balance-selection/design-notes.md):
  the selection module resolves one day for figures, markers, and accessibility,
  owns context resets and movement, and commits fallback without reviving an
  old lost date. The caller's remount key is removed.

## Standards

Two readonly-parameter findings were corrected and rechecked. No findings
remain. No additional judgment smells were raised.

## Spec

No actionable findings against the three confirmed design notes. The reviewers
performed source reviews only and did not run tests or reproduce runtime defects.

Review result: 0 remaining Standards findings; 0 Spec findings.

## Verification

- Web typechecking passed during implementation.
- Selection and existing Closing balance derivation tests: 16 passed.
- Reports and capture specs on `phone-chromium`: all 16 applicable cases
  passed across the main run and focused reruns; the desktop-only capture case
  was skipped intentionally. Coverage includes delayed reads, read-only
  recovery, late completion, live catalog changes, resumed defaults, exact
  selected-day agreement, keyboard movement, and pointer drag.
- The shared category-management scenario passed on `phone-chromium`.
- The full `pnpm run ci` gate passed: schema checks, lint, formatting,
  Markdown lint, typechecking, unit/integration/contract tests, API generation
  verification, and production builds. The web suite passed all 222 tests;
  unchanged tasks used the configured Turborepo cache. Heavy runs were exclusive.

The browser runner required host execution because Node's Windows user lookup
failed in the sandbox. No dependencies, schema, endpoint contracts, domain
rules, or global cache policies were changed.
