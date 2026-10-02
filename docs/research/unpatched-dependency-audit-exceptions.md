# Unpatched dependency audit exceptions

Researched 2026-10-02. Scope: whether the current exception for
`GHSA-86w9-cpqp-85rv` is defensible practice. This note records evidence and
recommendations. The repository owner subsequently accepted the temporary
exception and its review process on 2026-10-02.

## Conclusion

A narrowly scoped exception can be proper practice after assessing the actual
execution paths and recording the decision. Having no published fix, or needing
a green pull request, is insufficient justification. For this repository, the
installed dotenvx source provides a credible reason that the vulnerable RSA
verification function is outside the observed execution paths. The existing
comment records that reasoning. The accepted record below supplies an accountable
owner and a next review date. These are maintenance choices for this repository,
not mandatory pnpm settings.

[pnpm explicitly supports tolerating advisories that do not affect a project](https://pnpm.io/cli/audit#auditignore).
[OWASP recommends documenting interim handling and scoping an ignore to the individual vulnerability](https://cheatsheetseries.owasp.org/cheatsheets/Vulnerable_Dependency_Management_Cheat_Sheet.html#case-2).
OWASP also separates technical analysis from the organization's risk-acceptance
decision; here the repository owner fills that decision-making role.

## Evidence for this advisory

The [GitHub-reviewed advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
affects node-forge through 1.4.0 and lists no patched version as of this research.
It concerns malformed nested DigestAlgorithm elements accepted during RSA
PKCS#1 v1.5 signature verification, allowing signature forgery with low-exponent
RSA keys. This is a real vulnerable dependency, not a false package match.

Local inspection of the installed `@dotenvx/dotenvx@2.30.0` source found its sole
direct node-forge import in `src/lib/proxy/proxyCertificates.js`. That file
creates certificates, imports keys and signs certificates; it does not call
Forge's RSA signature verification API. Reproducible upstream locations:
[proxyCertificates.js](https://github.com/dotenvx/dotenvx/blob/v2.30.0/src/lib/proxy/proxyCertificates.js),
[configureProxy.js](https://github.com/dotenvx/dotenvx/blob/v2.30.0/src/lib/proxy/configureProxy.js),
and [run.js](https://github.com/dotenvx/dotenvx/blob/v2.30.0/src/cli/actions/run.js).
The upstream pages were unavailable to this browser; the source claims were
verified against the installed npm package, not those pages.

`dotenvx run` loads the proxy modules, so it can load node-forge even when only
loading environment variables. `configureProxy` returns before starting a proxy
when there are no active proxy credentials. Repository scripts use dotenvx for
environment loading and contain no explicit credential-proxy invocation. An
environment configuration change can affect proxy activation; no secret values
were inspected in this assessment.

Inference: the observed usage does not reach this advisory's vulnerable
verification operation. This is bounded source analysis, not a proof about every
possible future dotenvx version or environment. CISA recognizes
`Vulnerable_code_not_in_execute_path` as a not-affected justification, including
functions never called directly or indirectly, while cautioning against assuming
that an attacker cannot divert execution. See
[CISA VEX status justifications, section 3.5](https://www.cisa.gov/sites/default/files/2023-01/VEX_Status_Justification_Jun22.pdf).
The PDF text was available through the search index; direct retrieval returned 403. A formal VEX statement was not produced here.

The manifests classify dotenvx as a development dependency. The server Dockerfile
deploys production dependencies and starts `node dist/server.js`; the web runtime
contains the static build served by Caddy. Inference from the manifests and
Dockerfiles: dotenvx/node-forge are outside the intended production runtime.
Build and CI usage still deserve assessment because development tooling also
forms part of the supply chain. No final image inspection was performed.

## Recommended handling

- Keep the one GHSA exception and the moderate audit threshold. Describe the
  result as an assessed exception, rather than a fixed vulnerability.
- Record the owner's acceptance, the assessed dotenvx/node-forge versions, and
  a next review date; one week from the assessment is a reasonable first review.
- Reassess immediately when dotenvx usage, proxy configuration, dependency paths
  or advisory details change. Install and test a patched release when available,
  then remove the exception once the affected version is absent.
- Review upstream advisory/releases explicitly. Weekly npm Dependabot updates
  already exist, but an ignored advisory will no longer fail pnpm's gate, so
  automated updates alone do not establish that the exception is still justified.
- If analysis finds the vulnerable API reachable, investigate removing or
  replacing the dependency, applying a verified patch, or explicit risk
  acceptance. OWASP discusses these options in
  [its dependency-management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Vulnerable_Dependency_Management_Cheat_Sheet.html).

## Accepted exception record

- Advisory: `GHSA-86w9-cpqp-85rv` / `CVE-2026-85393`.
- Owner: repository owner, who accepted this temporary exception on 2026-10-02.
- Assessed versions: `@dotenvx/dotenvx@2.30.0` and `node-forge@1.4.0`.
- Basis: the bounded source and usage assessment above indicates that the
  vulnerable RSA verification operation is outside observed execution paths.
  The dependency remains vulnerable; this is not a patch or universal safety claim.
- Next review: 2026-10-09, then weekly. The owner checks the upstream advisory
  and node-forge/dotenvx releases, alongside existing weekly Dependabot updates.
- Earlier review triggers: changed dependency versions or paths, dotenvx usage,
  proxy configuration, or advisory details.
- Exit: install and test a patched release, then remove the GHSA exception once
  the affected version is absent. If the vulnerable operation becomes reachable,
  reassess immediately and remediate or explicitly reconsider acceptance.

The review dates are recorded responsibilities, not an automated reminder or
expiry enforced by pnpm. `audit.ignore` matches the GHSA across package versions,
so changes to the assessed dependency path require review even if audit passes.

## What passing CI establishes

The pinned pnpm version is 11.28.2. Its supported `audit.ignore` setting filters
the named GHSA; it does not remove or patch node-forge. Avoid applying newer
pnpm-only settings such as `audit.ignorePrune` (introduced in v12) to this repo.
[pnpm audit configuration](https://pnpm.io/cli/audit#configuration).

`CI` runs a full dependency audit. The separate `Dependency Review` job inspects
dependency changes between pull-request revisions and has its own `allow-ghsas`
configuration; it does not inherit pnpm's ignore list. Its v5.0.0 default
`fail-on-scopes` is `runtime`, while this dependency path is development-only.
See the [pinned action's documentation](https://github.com/actions/dependency-review-action/blob/v5.0.0/README.md#configuration-options).
Consequently, a local pnpm pass does not establish that all required hosted PR
checks pass. Inspect the actual hosted results before claiming the PR unblocked.

Registry signature verification checks package signatures, not whether a signed
package contains vulnerable code.
[pnpm audit signatures](https://pnpm.io/cli/audit#signatures).
