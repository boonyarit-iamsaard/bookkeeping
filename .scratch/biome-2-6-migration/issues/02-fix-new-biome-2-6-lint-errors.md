# 02: Fix the lint errors Biome 2.6 adds

**What to build:** The source passes the new recommended rules without
suppressions. Eight findings at the time of writing:
`useMathMinMax` (5, in the transaction domain code, the bar scale helper and
the balance trend report), `usePlaywrightValidDescribeCallback` (2, in the
web write-submission module) and `useDomNodeTextContent` (1, in an e2e date
helper). Behaviour must not change; the existing tests are the proof.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] `biome ci` reports no lint errors.
- [ ] Unit, integration and Hono contract suites pass.
- [ ] One focused SPA spec passes on one project, since the e2e date helper
      is touched. Follow the browser test execution policy and local
      resource limits.
- [ ] No `biome-ignore` comments are added.

## Comments

`usePlaywrightValidDescribeCallback` firing in a non-e2e web module may be a
false positive on a name like `describe`. If so, rename rather than ignore,
and say so in the closing note.
