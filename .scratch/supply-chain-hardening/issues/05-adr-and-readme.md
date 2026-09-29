# 05: ADR 0010 and README updates

**What to build:** a future reader can learn why `main` is protected and
production deploys are gated. One new ADR (next number after 0009) records the
trade-off: protecting `main` with an admin bypass limited to pull requests,
the settings copied from `stay`, digest pinning beyond `stay`, and refusing
`--trust-lockfile`. It carries the owner's checklist for the GitHub settings,
which ticket 06 follows. The README's dependency-update and CI notes are
updated to match. Earlier ADRs and `.scratch` stay historical; no `SECURITY.md`.
`CONTEXT.md` is unchanged, since no domain terms were added.

**Blocked by:** 03, 04.

**Status:** ready-for-agent

- [ ] The ADR follows the repo's ADR format and states context, decision, alternatives considered and consequences.
- [ ] The ADR contains the exact checklist: ruleset (PR with zero approvals, the three required checks, linear history, no force-push or deletion, admin bypass for pull requests only); read-only workflow token; required full-SHA pinning; approval for all outside-contributor runs; secret scanning with push protection; Dependabot alerts and security updates; private vulnerability reporting. Signed commits and CodeQL are recorded as declined.
- [ ] The README's dependency-update and CI notes match the new setup.
- [ ] Markdown lint and formatting checks pass.
- [ ] One commit, staged by the agent for the owner to run.
