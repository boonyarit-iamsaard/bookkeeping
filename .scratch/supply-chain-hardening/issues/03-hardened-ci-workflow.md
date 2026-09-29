# 03: Hardened CI workflow

**What to build:** the CI workflow runs only immutable, least-privilege
steps and audits the dependency tree. Every Action is pinned to a full commit
SHA with a version comment, checkout does not persist credentials, the token
stays read-only, `CI` runs `pnpm audit` at moderate severity plus
`pnpm audit signatures`, and pull requests get a `Dependency Review` job at
moderate severity. `--trust-lockfile` is not used. Job names are exactly `CI`,
`SPA browser suite` and `Dependency Review`, with no path filters, so no check
is left pending.

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] Every `uses:` reference is a full SHA with a version comment.
- [ ] Checkout steps set `persist-credentials: false`, and workflow permissions remain `contents: read`.
- [ ] `CI` runs the audit and signature audit and fails on a moderate advisory.
- [ ] `Dependency Review` runs only on pull requests and is skipped, not failed, on pushes to `main`.
- [ ] `CI`, `SPA browser suite` and `Dependency Review` each run green on GitHub at least once (so they become selectable in the ruleset).
- [ ] The browser suite is not run locally as part of this ticket.
- [ ] One commit, staged by the agent for the owner to run.
