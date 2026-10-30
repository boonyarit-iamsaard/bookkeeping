# 05: Integrate the migration and retire the Biome bump PR

**What to build:** Tickets 01 to 04 land together as one green pull request,
and the Dependabot dev-dependencies PR (#53) merges cleanly afterwards with
Biome already at 2.6. Green is promised only here, because tickets 02 to 04
each leave the other findings in place until all are done.

**Blocked by:** 01, 02, 03, 04.

**Status:** ready-for-agent

- [ ] `pnpm run ci` passes locally, and the PR's CI, Dependency Review and
      SPA browser suite pass.
- [ ] The branch is squash-merged to `main`.
- [ ] `@dependabot rebase` is requested on #53 and it merges once green,
      or Dependabot closes it as superseded.
- [ ] Every ticket in this feature is marked `done` with the commit named.

## Comments

Ticket 01 pinned Biome 2.6.3, the newest 2.6.x outside the repo's
`minimumReleaseAge` window (2.6.4 was published 2026-10-28). Before merging,
re-pin to 2.6.4 if it has cleared the window, matching #53, and re-count the
findings: ticket 01 saw 29 errors on 2.6.3 against 25 on 2.6.4.
