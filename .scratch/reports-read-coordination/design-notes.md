# Reports read coordination: design notes

Status: implemented

Candidate 1 from [the architecture review](../architecture-review-2026-10-02.html).
Decisions recorded during `/grill-with-docs` on 2026-10-02.

## Accepted decisions

1. **Coordinate all Reports reads.** The feature-local module owns preloading,
   subscriptions, readiness, and comparison-result identity. URL navigation,
   controls, rendering, and selected-day interaction stay with their current
   owners. Candidate 3 remains separate.
2. **Preserve user-visible behavior.** Keep the initial loading screen,
   page-wide error/retry handling, editable invalid filters, and comparison
   choice across months. While a comparison loads, keep the total line visible
   and hide wallet figures belonging to the previous choice. Independently
   loading sections are outside this refactor.
3. **Return prepared report data.** Call the existing Category spending,
   Closing balance, and six-month trend presentation derivations inside the
   read module. Retain their behavior and tests. The screen renders the result
   without assembling individual responses or stripping placeholder Wallet
   figures itself.
4. **Separate valid loading from invalid input.** When valid filters require
   reads that are still loading, show the existing loading skeleton. Reserve
   the invalid-filter notice for invalid input. This is the one accepted
   user-visible correction; it does not add section-level loading or a new
   midnight refresh policy.
5. **Use two entry points with one internal read inventory.** One entry point
   preloads Reports for the route; one hook supplies the screen with an
   `invalid`, `loading`, or `ready` state. Read failures continue to reach the
   existing page-wide error display. The screen retains comparison choice,
   passing it into the module, which owns response-identity handling.
6. **Extend the existing focused tests.** Retain presentation unit tests and
   add Reports browser regressions for delayed Wallet switches, clearing a
   pending comparison, month changes with comparison retained, and valid
   filters waiting for data. Use the existing HTTP interception tools; no new
   test framework is needed.

## Agreed module interface

The module stays feature-local under `apps/web/src/features/reports/`.
Exact filenames and function names are implementation choices following the
repository's conventions.

| Caller                    | Input                                                     | Result                                                                                                                   |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Route preload entry point | Existing QueryClient, report search, Bangkok today        | Preload all required base reads; invalid input performs no preload; read failures reach the existing route error display |
| Screen hook               | Report search, Bangkok today, optional compared Wallet id | Validated control values and an `invalid`, `loading`, or `ready` state; read failures use the existing thrown-error path |

The route continues to capture and return its initial Bangkok date. The screen
continues to use `useBangkokToday` and to own URL navigation and comparison
choice. The module consumes those values; it does not introduce another clock,
URL, cache, or comparison-state owner.

| Hook state | Meaning                                                                                               | Screen behavior                                             |
| ---------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `invalid`  | Month or Balance date is invalid; original values and invalid fields remain available                 | Render existing editable controls and invalid-filter notice |
| `loading`  | Filters are valid but one or more required reads have no usable data                                  | Render the existing Reports loading skeleton                |
| `ready`    | Every required read has usable data, including safe same-month total-only data while comparison loads | Render the prepared financial report                        |

Read errors do not become a fourth local state: the accepted existing
page-wide error display owns them.

Prepared data includes the monthly summary, Category spending breakdown,
Closing balance trend, six-month trend, and current/dated Wallet collections
needed by the existing report renderer. Existing exact Wallet totals and row
rendering remain in that renderer; no presentation redesign is introduced.

## What the implementation hides behind the seam

- A shared, internal base read inventory supports both preloading and observing.
  Adding a required read must not require enumerating it again in the route or
  screen. Keep the implementation concrete and typed; a generic read framework
  would enlarge the interface without giving this feature more leverage.
- The chosen month's monthly read and the same month's trend read retain the
  same existing cache key, so QueryClient can share their request/data.
- The loader preloads total Closing balances. Wallet comparison remains an
  on-demand observation, using the existing month/Wallet-specific cache key.
- The module controls enabling, error forwarding, readiness, and prepared-data
  construction. These details no longer leak into the Reports screen.
- While comparison loads, prefer previous totals only for the same month;
  otherwise use that month's preloaded total-only data. Strip Wallet figures
  from placeholders before deriving presentation. No old Wallet value may be
  named as the newly chosen Wallet.
- Keep the existing HTTP adapter and abort-signal propagation. No injected
  transport abstraction is required merely to make the module testable.

## Ownership after the refactor

| Owner                              | Responsibilities                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reports read module                | Validation consumption, base inventory, preloading, subscriptions, readiness, comparison-result identity, existing presentation derivation calls |
| Route                              | Search validation integration, initial Bangkok date, invocation of preload entry point, loading/error mounts                                     |
| Reports screen                     | Current Bangkok date input, URL navigation, month/date controls, compared Wallet choice, rendering the module state                              |
| Financial report and chart modules | Layout, exact rendered figures, selected-day state, gestures, accessibility, current reset behavior                                              |
| Core read/cache modules            | Endpoint declarations, cache keys, transport, global refresh/deletion/session policy                                                             |
| Server/application modules         | Existing financial calculations and owner-scoped reads                                                                                           |

Depth comes from removing read coordination knowledge from the two callers.
The interface is the test surface: observable report states and figures matter,
not the number or names of internal helper functions.

## Established constraints

- Keep read declarations in `apps/web/src/core/api/queries.ts`, with keys based
  on OpenAPI paths and parameters.
- Preserve the centralized `refreshAfterWrite`, deletion, and session-reset
  conventions in `docs/code-conventions.md`.
- Financial calculations remain server-owned. Existing client presentation
  derivations remain useful and retain their existing behavior.
- The compared Wallet is page state, outside the URL, and remains selected
  across month changes, as decided in the level 3 reports ticket 04.
- Existing retry behavior remains: an error replaces the report, and retry
  reloads its month/date with no compared Wallet selected. Preserving comparison
  through an error or introducing a comparison-only error display is outside
  the accepted behavior-preserving scope.
- Existing implicit Bangkok date/month defaults continue to advance through
  `useBangkokToday`. Adding timer-driven cache invalidation or a new freshness
  policy is outside this refactor.
- Use root `CONTEXT.md` for domain vocabulary, following this repository's doc
  layout. Read coordination is an implementation responsibility, not a new
  domain concept. No glossary addition or ADR is justified yet.
- Shared understanding was confirmed on 2026-10-02. The owner explicitly
  placed implementation on hold while considering candidates 2 and 3, then
  released the hold for all three candidates with `/implement all`.

## Verification plan

- Retain report search/defaults and the existing Category spending, Closing
  balance, and six-month trend unit tests. Calling their modules from a new
  owner does not make their useful behavior coverage redundant.
- Keep the existing Reports browser coverage for real reads, invalid filters,
  initial loading, month/date changes, comparison, clearing, and error/retry.
- Add focused delayed-response scenarios through the rendered interface: a
  ready Wallet A followed by a pending Wallet B must retain total figures
  without showing A as B; clearing a pending comparison must remove Wallet
  figures and a late response must not restore them.
- Verify that a chosen Wallet survives a month change, and that the new
  month's totals are used while its Wallet response loads.
- Verify the accepted correction: valid inputs awaiting required data show
  the loading skeleton, then the report; the invalid-filter notice does not
  appear during that wait. Date advancement without navigation is an existing
  way to exercise the valid-but-not-ready path.
- Use the existing browser HTTP interception tools for delayed responses.
  Avoid SPA component-test infrastructure or a second production adapter.
- During implementation, run `pnpm run ci` and the focused Reports spec on
  `phone-chromium`, with browser execution exclusive under AGENTS.md. No full
  browser matrix, Sonar scan, or production browser gate is required by this
  scope.

## Interview outcome

All six recommendations were accepted and the user confirmed shared
understanding on 2026-10-02. No design questions remain open for candidate 1.
The user authorized implementation of all three candidates on 2026-10-02.
This is one scoped client refactor suitable for `/implement`; a multi-ticket
build is not needed.

## Source facts before implementation

- The loader manually preloads the base read inventory, using `ensureQueryData`.
  Cached results may render before observers refetch; existing conventions
  accept this behavior.
- Comparison queries use month/Wallet-specific keys and propagate the request
  abort signal through the existing HTTP adapter. Existing placeholder handling
  keeps same-month totals and strips Wallet fields before deriving presentation.
- The screen's current ready-data guard falls through to its invalid-filter
  notice when a valid address has missing data. Date changes without navigation
  can expose this path. This is source-supported; no failure was reproduced.
- The error display replaces report children. The comparison choice is local
  state in those children, so it does not survive retry. The existing browser
  retry test covers a missing-data monthly preload failure; other failure paths
  need verification rather than assumptions of broken recovery.
- Vitest runs in Node and the repo has no SPA component tests. The Reports
  browser spec already intercepts HTTP responses for loading and error cases,
  so delayed-response coverage does not require a new transport framework.

## Source pointers

- `apps/web/src/features/reports/report-queries.ts`: current validation and
  read inventory.
- `apps/web/src/routes/_app/reports.tsx`: current manual preload inventory.
- `apps/web/src/features/reports/components/reports.tsx`: subscriptions,
  readiness guard, comparison placeholders, and presentation derivations.
- `apps/web/src/core/shell/load-error.tsx`: existing retry operation.
- `apps/web/tests/e2e/reports.spec.ts`: observable Reports behavior coverage.

## Implementation outcome

`report-reads.ts` now owns the shared preload inventory, subscriptions,
readiness, comparison placeholders, and prepared presentation data. The route
and screen use its two entry points. Valid pending reads render the existing
loading screen.

The focused Reports browser cases and `pnpm run ci` passed. Standards and Spec
reviews have no remaining findings. See the
[implementation record](../architecture-implementation-2026-10-02.md) for scope
and verification results. Source pointers above describe the original snapshot;
`report-queries.ts` was replaced by `report-reads.ts`.
