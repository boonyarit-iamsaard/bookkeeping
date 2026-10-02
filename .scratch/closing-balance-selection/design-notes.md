# Selected Closing balance day: design notes

Status: implemented

Candidate 3 from [the architecture review](../architecture-review-2026-10-02.html).
Decisions recorded during `/grill-with-docs` on 2026-10-02. All three candidates
were confirmed before the user authorized `/implement all`.

## Accepted decisions

1. **Concentrate selection ownership.** One Reports module owns the selected
   day, default/reset rules, keyboard movement, and matching markers/readout.
   Keep pointer geometry, focus, and rendering in the existing browser adapter.
   Reports read coordination remains candidate 1's responsibility.
2. **Correct selection reconciliation on refresh.** When refreshed data no
   longer has a tracked total for the selected day, resolve one valid day for
   the total marker, exact figures, Wallet marker, and accessible slider text.
   Preserve existing behavior elsewhere. No display may independently fall
   back to a different day.
3. **Own resets without the caller's remount protocol.** Month or Balance
   date changes reset selection to the default. Same-context refreshes and
   comparison loading, arrival, switching, or clearing retain a still-tracked
   selection. Empty/future output clears selection; returning to tracked data
   starts at the default. Returning to a previously viewed month does not
   restore its earlier manual selection. Move these rules into the selection
   module instead of relying on `FinancialReport`'s month/Balance date key.
4. **Use the existing default for a lost selected day.** When the selected
   date no longer has a tracked total, choose the Balance date if it has a
   tracked total, otherwise the last tracked day. Do not introduce a separate
   nearest-date fallback for refresh reconciliation.
5. **Preserve movement over tracked total positions.** Arrows move one
   tracked position; PageDown/PageUp move seven backward/forward; Home/End
   choose the first/last. Clamp at endpoints and skip dates without totals.
   Pointer selection chooses the nearest tracked date horizontally, with
   earlier dates winning exact ties. Keep pointer capture and drag behavior.
   A missing compared Wallet figure does not prevent choosing a date with a
   total; retain "Not open yet" and no Wallet marker on that date.
6. **Commit fallback as the new selection.** A fallback replaces the lost
   selected date. If later data restores the old date, do not automatically
   revive it. Keep the current tracked selection until an explicit user
   movement, context reset, or another loss requires a change.
7. **Keep the selection interface small and coherent.** Callers supply the
   report month, Balance date, and prepared trend. The module provides one
   resolved selection containing its index, exact day figures, and matching
   total/Wallet marker positions, plus movement actions. The browser adapter
   computes normalized pointer position from DOM geometry. Comparison choice,
   reads, URLs, and clocks retain their existing owners. Empty/future output
   has no resolved selection and retains its existing display.
8. **Verify transitions and rendered agreement.** Retain existing derivation
   tests. Add selection-transition tests for resets, tracked gaps, fallback,
   and later restoration of a lost date. Extend the focused Reports browser
   spec to assert that marker, exact readout, and slider announcement agree;
   comparison changes retain selection; keyboard endpoints/Page keys and
   pointer drag work. Reuse candidate 1's delayed-response coverage when it
   exercises the same path instead of duplicating it. Follow the repository's
   one-project browser policy and exclusive heavy-run limits.

## Established constraints

- Retain the original level 3 Reports specification, Closing balance meaning,
  and ADR 0001. Financial calculations remain server-owned; this work concerns
  selection and presentation ownership.
- Preserve the current chart appearance, total/Wallet series derivation,
  comparison choices, exact money, hidden table, and empty/future messages.
- Keep existing read contracts, cache ownership, and post-write refresh policy.
  No schema, endpoint, cache framework, or charting-library changes.
- Use the repository's root `CONTEXT.md`. Selected-day interaction is not a
  new financial domain concept; no glossary addition or ADR is justified yet.
- Implementation of all three agreed candidates was authorized on 2026-10-02.

## Shared understanding

All eight interview decisions were accepted and the user confirmed shared
understanding on 2026-10-02, releasing the implementation hold for all three
candidates with `/implement all`.

## Source facts before implementation

- `createBalanceTrend` defaults to the Balance date when it has a tracked
  total, otherwise the last tracked day.
- `FinancialReport` currently resets the chart by a month/Balance date React
  key. `BalanceLine` initializes local selection from the trend's default.
- The current marker/index falls back to the first tracked point when its
  stored selected date is absent from the points. The readout and Wallet
  marker still search the stored date independently. A date can remain in
  the response but lose its tracked total after an opening-date correction.
  This mismatch is source-supported, not a reproduced runtime failure.
- The chart's selectable points come from the total series. Pointer selection
  finds the nearest point; key movement walks tracked points with clamping.
- Existing browser coverage verifies default selection, ArrowLeft/Right,
  comparison arrival/clearing, and a month round trip. It does not directly
  assert pointer selection, Home/End/Page keys, delayed-comparison retention,
  or reconciliation after a same-context refresh loses a selected total.
  Existing pure derivation tests cover defaults, gaps, exact scale, and
  empty/future output; retain them.

## Source pointers

- `apps/web/src/features/reports/balance-trend.ts`
- `apps/web/src/features/reports/balance-trend.unit.test.ts`
- `apps/web/src/features/reports/components/balance-over-time.tsx`
- `apps/web/src/features/reports/components/financial-report.tsx`
- `apps/web/tests/e2e/reports.spec.ts`
- `.scratch/level-3-reports/spec.md`
- `.scratch/level-3-reports/issues/03-balance-over-time-total-line.md`
- `.scratch/level-3-reports/issues/04-balance-over-time-compare-one-wallet.md`

## Implementation outcome

`balance-selection.ts` and `use-balance-selection.ts` now resolve one selected
day and own resets, committed fallback, and tracked-position movement.
The chart keeps DOM geometry, pointer capture, focus, and rendering. The
caller's month/Balance date remount key is removed.

Selection transition tests, the focused Reports browser cases, and
`pnpm run ci` passed. Standards and Spec reviews have no remaining findings.
See the [implementation record](../architecture-implementation-2026-10-02.md)
for scope and verification results.
