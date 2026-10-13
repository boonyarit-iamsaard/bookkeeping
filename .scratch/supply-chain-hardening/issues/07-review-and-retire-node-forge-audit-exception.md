# 07: Review and retire the node-forge audit exception

**What to build:** Keep the temporary exception for `GHSA-86w9-cpqp-85rv`
(`CVE-2026-85393`) under active review until it can be retired. The owner can
see the latest exposure assessment, upstream fix status, and next review date;
when a supported fix becomes available, upgrade and verify it before removing
the exception. Preserve enforcement for other moderate-or-higher advisories.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Owner:** Repository owner.

**Next review:** none; the exception is retired on the branch below and awaits merge.

- [x] On October 9, check the upstream advisory and node-forge/dotenvx releases
      for a published fix, and record the findings under Comments with dated sources.
- [ ] Reassess the installed dependency paths and dotenvx execution paths against
      the affected RSA signature verification operation. The original assessment
      covered dotenvx 2.30.0 and node-forge 1.4.0; loading Forge does not by itself
      establish that its vulnerable verification operation is reachable.
      Superseded on 2026-10-13: the upgrade removes node-forge, so the path was
      not reassessed.
- [x] Review earlier if dependency versions or paths, dotenvx usage, proxy
      configuration, or advisory details change.
- [ ] If no supported fix is available and the exposure assessment still holds,
      record the owner's continued acceptance and the next weekly review date. Keep
      this ticket open and repeat the review; a passing audit alone does not justify
      renewal.
- [ ] If the vulnerable operation becomes reachable or the assessment becomes
      uncertain, report the evidence to the owner and reassess remediation or risk
      acceptance before continuing the exception.
- [x] Once a supported fix is available, install it, verify the affected version
      is absent, and remove this advisory's exception. Run the frozen-lockfile
      install, moderate-level audit, registry signature verification, and routine CI
      gate. Apply the repository's browser policy if the change touches that boundary.
- [ ] Verify the hosted required PR checks before claiming the PR is unblocked;
      Dependency Review is separate from pnpm's audit exception.
- [ ] Close this ticket only after the exception is retired and the verified
      remediation commit is recorded. Document the final versions and check results.

## Comments

2026-10-02: The repository owner approved this follow-up ticket. Commit `1238000`
updated the two patchable transitive dependencies and recorded the owner's
temporary acceptance of the remaining advisory. The documented assessment found
Forge certificate generation/signing rather than the affected RSA verification
operation in the observed dotenvx usage. This is a bounded usage assessment, not
a patch or a guarantee about future versions or configuration.

The October 9 date is a recorded responsibility, not an automated reminder.

Upstream advisory:
[GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv).

### 2026-10-13: review, and retirement by dropping node-forge

Reviewed four days late; the October 9 review was missed.

Upstream status, checked 2026-10-13:

- The [GitHub advisory](https://api.github.com/advisories/GHSA-86w9-cpqp-85rv)
  is unchanged since 2026-10-01: high, `node-forge <= 1.4.0`, no patched version.
- node-forge has no release after 1.4.0 (2026-03-24), per `pnpm view node-forge time`.
- dotenvx no longer depends on node-forge. `pnpm view @dotenvx/dotenvx@<v> dependencies`
  lists `node-forge` at 2.32.4 and not at 2.33.0 (2026-10-05) or later; 2.34.0
  (2026-10-09) also drops `global-agent`, the only path to sprintf-js
  (`GHSA-hp3w-g68c-fv3c`). The
  [changelog](https://github.com/dotenvx/dotenvx/blob/main/CHANGELOG.md)'s
  breaking changes for 2.32.0 to 2.34.2 (`init`, `lock`, Envfile renames) do not
  touch this repository's `dotenvx run -f .env --ignore=MISSING_ENV_FILE` usage.

Installed path before the change: `@dotenvx/dotenvx@2.32.4` (the Dependabot bump
since the 2.30.0 assessment) → `node-forge@1.4.0`, development-only in database,
server and web. The 2.30.0 analysis was not repeated for 2.32.4, because the fix
removes the dependency instead.

Remediation on branch `build/retire-node-forge-audit-exception`: `@dotenvx/dotenvx`
`^2.32.4` → `^2.34.2` in the three manifests (2.34.2 published 2026-10-09, past
the three-day `minimumReleaseAge`), and `GHSA-86w9-cpqp-85rv` and
`GHSA-hp3w-g68c-fv3c` removed from `audit.ignore`. `GHSA-vfj7-8cjw-p6xm`
(braces) stays.

Verification, 2026-10-13, local:

- `pnpm why node-forge -r` and `pnpm why sprintf-js -r` find nothing; the lockfile
  has no `node-forge`, `global-agent`, `roarr` or `sprintf-js` entries.
- `pnpm install --frozen-lockfile`: up to date.
- `pnpm audit --audit-level moderate`: passes; one low finding, one ignored high
  (braces).
- `pnpm audit signatures`: 1128 packages verified.
- `dotenvx run -f .env --ignore=MISSING_ENV_FILE` in `packages/database` on 2.34.2
  injects `.env` as before.
- `pnpm run ci`: passes, including 86 test files across seven packages.
- No browser test ran: dotenvx only loads the e2e runner's environment, and the
  hosted e2e job exercises `test:e2e:ci`.

A second copy, `@dotenvx/dotenvx@1.75.1`, stays installed through `shadcn@4.21.1`
and `@shadcn/registry@0.1.0`. Its dependencies include none of the four removed
packages, so the affected versions remain absent.

Owner decisions, 2026-10-13: the repository owner accepted removing the
dependency as this ticket's supported fix, in place of a patched node-forge
release, and accepted retiring `GHSA-hp3w-g68c-fv3c`, which was accepted on
2026-10-07 outside this ticket, in the same change.

Remaining before `done`: hosted required PR checks, including Dependency Review,
then record the merged commit here.
