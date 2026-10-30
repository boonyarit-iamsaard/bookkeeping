# 05: Integrate the migration and retire the Biome bump PR

**What to build:** Tickets 01 to 04 land together as one green pull request,
and the Dependabot dev-dependencies PR (#53) merges cleanly afterwards with
Biome already at 2.6. Green is promised only here, because tickets 02 to 04
each leave the other findings in place until all are done.

**Blocked by:** 01, 02, 03, 04.

**Status:** done (c067180)

- [x] `pnpm run ci` passes locally, and the PR's CI, Dependency Review and
      SPA browser suite pass.
- [x] The branch is squash-merged to `main`.
- [x] `@dependabot rebase` is requested on #53 and it merges once green,
      or Dependabot closes it as superseded.
- [x] Every ticket in this feature is marked `done` with the commit named.

## Comments

Ticket 01 pinned Biome 2.6.3, the newest 2.6.x outside the repo's
`minimumReleaseAge` window (2.6.4 was published 2026-10-28). Before merging,
re-pin to 2.6.4 if it has cleared the window, matching #53, and re-count the
findings: ticket 01 saw 29 errors on 2.6.3 against 25 on 2.6.4.

Done 2026-10-30 in c067180 (PR #55, squash-merged). `pnpm run ci` passed
locally and the PR's CI, Dependency Review and SPA browser suite passed.
Biome stays on 2.6.3: 2.6.4 clears the `minimumReleaseAge` window at
2026-10-31 23:54 UTC, so the re-pin waits for a later bump. `@dependabot
rebase` on #53 ended with Dependabot closing it as superseded; its other seven
dev-dependency updates will return in a new Dependabot PR.
