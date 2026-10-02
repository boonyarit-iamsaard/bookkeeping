# 07: Review and retire the node-forge audit exception

**What to build:** Keep the temporary exception for `GHSA-86w9-cpqp-85rv`
(`CVE-2026-85393`) under active review until it can be retired. The owner can
see the latest exposure assessment, upstream fix status, and next review date;
when a supported fix becomes available, upgrade and verify it before removing
the exception. Preserve enforcement for other moderate-or-higher advisories.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Owner:** Repository owner.

**Next review:** 2026-10-09, then weekly until the exception is retired.

- [ ] On October 9, check the upstream advisory and node-forge/dotenvx releases
      for a published fix, and record the findings under Comments with dated sources.
- [ ] Reassess the installed dependency paths and dotenvx execution paths against
      the affected RSA signature verification operation. The original assessment
      covered dotenvx 2.30.0 and node-forge 1.4.0; loading Forge does not by itself
      establish that its vulnerable verification operation is reachable.
- [ ] Review earlier if dependency versions or paths, dotenvx usage, proxy
      configuration, or advisory details change.
- [ ] If no supported fix is available and the exposure assessment still holds,
      record the owner's continued acceptance and the next weekly review date. Keep
      this ticket open and repeat the review; a passing audit alone does not justify
      renewal.
- [ ] If the vulnerable operation becomes reachable or the assessment becomes
      uncertain, report the evidence to the owner and reassess remediation or risk
      acceptance before continuing the exception.
- [ ] Once a supported fix is available, install it, verify the affected version
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
