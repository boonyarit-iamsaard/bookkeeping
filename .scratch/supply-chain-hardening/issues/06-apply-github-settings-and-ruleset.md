# 06: Apply the GitHub settings and ruleset

**What to build:** `main` is protected and the repository's GitHub settings match
the ADR checklist. The owner applies these by hand in the GitHub UI; `gh` is not
installed and no script is written. Order matters: the three required checks
must have succeeded within the last seven days to be selectable, and the
full-SHA pinning requirement is only safe once ticket 03 has landed.

**Blocked by:** 03, 04, 05.

**Status:** done

- [x] A ruleset on `main` requires a pull request with zero approvals and the checks `CI`, `SPA browser suite` and `Dependency Review`, requires linear history, and blocks force-push and deletion.
- [x] The ruleset's bypass is repository admin, for pull requests only.
- [x] Default workflow token permissions are read-only.
- [x] Actions are required to be pinned to a full-length commit SHA.
- [x] Approval is required for workflow runs from all outside contributors.
- [x] Secret scanning with push protection, Dependabot alerts and security updates, and private vulnerability reporting are enabled.
- [x] Signed commits and CodeQL are left off.
- [x] The UNVERIFIED items at the end of `docs/research/supply-chain-hardening.md` (live repo settings, merge-method toggles, bypass wording) are confirmed in the UI and any surprises are appended under `## Comments`.
- [x] A trial pull request confirms the ruleset blocks a direct push and that Railway still deploys on merge.

## Comments

Confirmed in the GitHub UI on 2026-09-29:

- Default workflow token permission was already read-only. Allow Actions to create and approve pull requests is off.
- Fork pull request approval defaulted to "first-time contributors"; it is now "all external contributors".
- Secret scanning, push protection, Dependabot alerts, Dependabot security updates, private vulnerability reporting and the dependency graph were already enabled. CodeQL is off. Copilot Autofix is on but inert without CodeQL. Dependabot malware alerts and grouped security updates are off.
- Merge methods were Merge, Squash and Rebase. The ruleset now allows Squash and Rebase only, because linear history rejects merge commits.
- The ruleset offers the Repository admin bypass with "Allow for pull requests only", and the required checks were selectable from a single pull request run. Evaluate mode is offered on this personal repo.
- The ruleset UI enables "Require conversation resolution", "Dismiss stale approvals" and "Require branches to be up to date" alongside the ticket's rules; they cost a solo owner little.
- A direct push of an empty commit to `main` was rejected with GH013: "Changes must be made through a pull request" and "3 of 3 required status checks are expected".
- Pull request #1 was squash-merged as `1b959cb` and Railway deployed it. Railway holds a deployment in "Waiting for CI" until the check suites for the commit finish, including the Dependabot pull requests' runs, so a deploy can sit waiting for several minutes after CI is green. The Dependabot tab accepted `.github/dependabot.yml` ("Dependabot config file validation" passed on the pull request).
