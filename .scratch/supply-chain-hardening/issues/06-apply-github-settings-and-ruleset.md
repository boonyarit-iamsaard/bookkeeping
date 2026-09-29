# 06: Apply the GitHub settings and ruleset

**What to build:** `main` is protected and the repository's GitHub settings match
the ADR checklist. The owner applies these by hand in the GitHub UI; `gh` is not
installed and no script is written. Order matters: the three required checks
must have succeeded within the last seven days to be selectable, and the
full-SHA pinning requirement is only safe once ticket 03 has landed.

**Blocked by:** 03, 04, 05.

**Status:** ready-for-human

- [ ] A ruleset on `main` requires a pull request with zero approvals and the checks `CI`, `SPA browser suite` and `Dependency Review`, requires linear history, and blocks force-push and deletion.
- [ ] The ruleset's bypass is repository admin, for pull requests only.
- [ ] Default workflow token permissions are read-only.
- [ ] Actions are required to be pinned to a full-length commit SHA.
- [ ] Approval is required for workflow runs from all outside contributors.
- [ ] Secret scanning with push protection, Dependabot alerts and security updates, and private vulnerability reporting are enabled.
- [ ] Signed commits and CodeQL are left off.
- [ ] The UNVERIFIED items at the end of `docs/research/supply-chain-hardening.md` (live repo settings, merge-method toggles, bypass wording) are confirmed in the UI and any surprises are appended under `## Comments`.
- [ ] A trial pull request confirms the ruleset blocks a direct push and that Railway still deploys on merge.
