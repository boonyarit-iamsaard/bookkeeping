# Sonar analysis runs in SonarQube Cloud

The local `pnpm sonar:scan` stalls on native Windows. Its scanner container
reads `node_modules` across Docker Desktop's file share, and a scan ran about
half an hour without finishing. When it does work, it's a heavy, exclusive
task with no history, and its findings land long after the code was written.
So routine analysis moves to SonarQube Cloud on the Free plan. The
`SonarQube Cloud` workflow scans every pull request into `main` and every push
to `main`, and the GitHub App posts findings on new code to the pull request.
The check is advisory: it's not one of the required checks in ADR 0010. The
design is in [#333](https://github.com/boonyarit-iamsaard/bookkeeping/issues/333).

## Considered options

- Self-hosting SonarQube Community Build in GitHub Actions: rejected. It can't
  analyze pull requests, so findings would not reach the change that caused
  them.
- Hosting SonarQube on Railway: rejected. An always-on server costs roughly
  $10–25 a month and sits mostly idle, beside production finances.
- The SonarQube Cloud OSS plan: rejected. It requires an open-source license,
  and adding one only to qualify is a legal decision, not a tooling one. The
  repository stays public with no license, which the Free plan accepts.
- Automatic analysis: rejected for CI-based analysis. Automatic analysis
  ignores `sonar-project.properties`, doesn't support monorepos, and
  conflicts with a CI scanner on the same project. It is turned off.

## Consequences

- `sonar-project.properties` stays the only source of analysis settings. It
  carries the Cloud organization and project keys; the local scan overrides
  the project key for its own server.
- The Free plan can't assign a non-default profile, so JavaScript and
  TypeScript run **Sonar way core**, not the Sonar way comprehensive profile
  the local scan uses. Cloud reports fewer findings than a local scan, and the
  gap isn't a bug. The local scan stays available for a comprehensive sweep.
- Only pull requests targeting `main` are analyzed, so the upper pull
  requests in a stack get no Sonar check.
- Pull requests without `SONAR_TOKEN`, such as Dependabot's or a fork's, skip
  the scan and pass.
- Findings are fixed as follow-up work; the check never blocks a merge.
