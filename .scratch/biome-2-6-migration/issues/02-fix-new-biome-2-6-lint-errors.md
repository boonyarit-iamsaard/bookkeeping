# 02: Fix the lint errors Biome 2.6 adds

**What to build:** The source passes the new recommended rules without
suppressions. Eight findings at the time of writing:
`useMathMinMax` (5, in the transaction domain code, the bar scale helper and
the balance trend report), `usePlaywrightValidDescribeCallback` (2, in the
web write-submission module) and `useDomNodeTextContent` (1, in an e2e date
helper). Behaviour must not change; the existing tests are the proof.

**Blocked by:** 01.

**Status:** done (c849834)

- [x] `biome ci` reports no lint errors.
- [x] Unit, integration and Hono contract suites pass.
- [x] One focused SPA spec passes on one project, since the e2e date helper
      is touched. Follow the browser test execution policy and local
      resource limits.
- [x] No `biome-ignore` comments are added.

## Comments

`usePlaywrightValidDescribeCallback` firing in a non-e2e web module may be a
false positive on a name like `describe`. If so, rename rather than ignore,
and say so in the closing note.

Done 2026-10-29 in c849834. `usePlaywrightValidDescribeCallback` was a false
positive on the name `describe`; the field-error callback in
`write-submission.ts` is renamed `describeError`, with no ignore. `useMathMinMax`
is also a false positive here: the operands are `bigint` and ISO date strings,
where `Math.min` and `Math.max` throw or return `NaN`, so the comparisons are
rewritten as loops and a sort. Checked with the unit, integration and contract
suites and `reports.spec.ts` on `phone-chromium` and `desktop-chromium`.
`transaction.ts` shrank, so its token-budget baseline was lowered to match.
The readability of the sort is followed up in backlog ticket 06.
