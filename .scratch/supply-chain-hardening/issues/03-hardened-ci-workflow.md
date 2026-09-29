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

**Status:** done

- [x] Every `uses:` reference is a full SHA with a version comment.
- [x] Checkout steps set `persist-credentials: false`, and workflow permissions remain `contents: read`.
- [x] `CI` runs the audit and signature audit and fails on a moderate advisory.
- [x] `Dependency Review` runs only on pull requests and is skipped, not failed, on pushes to `main`.
- [x] `CI`, `SPA browser suite` and `Dependency Review` each run green on GitHub at least once (so they become selectable in the ruleset).
- [x] The browser suite is not run locally as part of this ticket.
- [x] One commit, staged by the agent for the owner to run.

## Closing note

Built in `9479f3f`. Verified on PR #1: `CI`, `SPA browser suite` and
`Dependency Review` all passed. An esbuild override in `pnpm-workspace.yaml`
clears the moderate advisory that the new audit step otherwise failed on.
