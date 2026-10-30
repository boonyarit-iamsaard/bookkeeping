# Railway config as code cutoff: what Infrastructure as Code covers

Researched 2026-10-30. Scope: whether Railway's Infrastructure as Code (IaC,
`.railway/railway.ts`) can hold every setting that `apps/server/railway.json`
and `apps/web/railway.json` apply today (Dockerfile builder and
`dockerfilePath`, watch patterns, health check path, restart policy
`ON_FAILURE`, server-only `drainingSeconds: 10`), how `railway config plan` and
apply authenticate, and what the 2026-12-01 cutoff does to a service that did
nothing. Inputs read from the repo: ticket
`.scratch/deployment/issues/06-move-off-railway-config-as-code.md`, both
`railway.json` files, ADR 0010 and `.scratch/deployment/railway-runbook.md`.
Primary sources only: `docs.railway.com` pages as served from the
`railwayapp/docs` repo, the Railway changelog, and the source of the Railway
CLI and TypeScript SDK on GitHub (all fetched 2026-10-30). No Railway account
was touched and no Railway CLI command was run.

## Findings from primary sources

### The deprecation and the cutoff

Docs say: "Config as Code is deprecated. ... Existing `railway.json` /
`railway.toml` files continue to work for services that already use them until
**2026-12-01** (hard cutoff). New services cannot opt into Config as Code."
<https://docs.railway.com/config-as-code>
(source: <https://github.com/railwayapp/docs/blob/main/content/docs/config-as-code.md>)

The IaC page adds that config as code "is still read from your service
repository during deploy for existing (legacy) services, and it overrides
dashboard values for that service ... Existing Config as Code files stop being
read on **2026-12-01** (hard cutoff)." It also says a service cannot be managed
by both systems, and `railway config plan` stops for a service still managed by
a `railway.json`. <https://docs.railway.com/infrastructure-as-code>
(source: `content/docs/infrastructure-as-code.md` in `railwayapp/docs`)

Changelog #0304 (2026-08-20): "Config as Code is going away in favor of our new
IaC SDK. Starting August 28, services in new projects will no longer be
deployed using Config as Code (new services in existing projects should be
fine), with the old system going away on December 1."
<https://railway.com/changelog/2026-08-20-railway-anon>

Changelog #0312 (2026-10-16) says generating the IaC file and switching
services away from config as code "are separate steps", that
`railway config migrate --apply` writes the file without switching, and that
`railway config migrate cutover` lists the affected services, warns about
redeploys, saves the previous config-file paths and switches; `migrate undo`
restores them. <https://railway.com/changelog/2026-10-16-activity-feed-filters>
The CLI source agrees: cutover "clears each service's Config File path and
redeploys it", and a snapshot is kept in `.railway/.cac-migration.json`.
<https://github.com/railwayapp/cli/blob/master/src/commands/config/migrate.rs>
Note the IaC page text says `migrate --apply` "clear[s] Railway Config File
settings"; the changelog and the CLI source put the clearing in `cutover`. The
docs disagree with each other here.

### What the IaC `service()` options document

The reference lists `source`, `build`, `start`, `healthcheck`,
`healthcheckTimeout`, `preDeploy`, `replicas`, `tracing`, `env`, `domains` and
`volumeMounts`, and documents `build` only as a build command string. It says
nothing of builder, Dockerfile path, watch patterns, restart policy or draining.
<https://docs.railway.com/infrastructure-as-code/reference>

So the ticket's claim is true of the documentation. It is not true of the
tooling. The TypeScript SDK's `service()` accepts `build?: string |
BuildConfig` and `deploy?: DeployConfig` objects.
<https://github.com/railwayapp/railway-ts-sdk/blob/main/src/iac/sdk.ts>
The schema types behind them include `build.builder` (`DOCKERFILE`, `RAILPACK`,
...), `build.dockerfilePath`, `build.watchPatterns`, `deploy.healthcheckPath`,
`deploy.restartPolicyType` (`ON_FAILURE`, `ALWAYS`, `NEVER`),
`deploy.restartPolicyMaxRetries`, `deploy.drainingSeconds` and
`deploy.overlapSeconds`. Also `source.rootDirectory` and `source.checkSuites`
(the "Wait for CI" flag).
<https://github.com/railwayapp/railway-ts-sdk/blob/main/src/iac/schema.ts>
(SDK `v3.16.0`, 2026-10-14.) The CLI's compiler copies a service's `build` and
`deploy` objects into the environment config unchanged, and copies `source`
keys `rootDirectory`, `commitSha`, `upstreamUrl`, `checkSuites`, `autoUpdates`.
<https://github.com/railwayapp/cli/blob/master/src/iac/compiler.rs>
The CLI's own migrate tests expect output such as
`build: { buildCommand: "pnpm build", dockerfilePath: "Dockerfile.api" }`.
<https://github.com/railwayapp/cli/blob/master/src/commands/config/migrate.rs>

What `railway config migrate` reads from a `railway.json` is a fixed struct:
build `builder`, `buildCommand`, `dockerfilePath`, `watchPatterns`; deploy
`startCommand`, `preDeployCommand`, `preDeployTimeoutSeconds`,
`healthcheckPath`, `healthcheckTimeout`, `numReplicas`, `region`,
`multiRegionConfig`, `cronSchedule` (same file). It has no field for
`restartPolicyType` or `drainingSeconds`, so by my reading of the code
(inference, not run) migrate drops both silently, and its one-line summary
never mentions them.

### Authentication, and whether CI is needed

Docs say: run `railway login` and `railway link`; `plan` and `apply` "run
wherever you run them: locally or in your CI. Railway doesn't read `.railway/`
during deploys." For CI, "create a project token for the target environment and
store it as the `RAILWAY_TOKEN` repository secret. A project token is scoped to
one environment." <https://docs.railway.com/infrastructure-as-code>
The CLI page: authentication "uses your CLI login, `RAILWAY_API_TOKEN`, or an
environment-scoped `RAILWAY_TOKEN`." <https://docs.railway.com/cli/config>
(source: `content/docs/cli/config.md`.) The `railwayapp/config@v1` GitHub
Action is offered, not required: it plans on pull requests that touch
`.railway/**` and applies on merge, and needs `id-token: write`.

Local-only apply is viable by the docs: nothing requires CI, and `apply`
confirms interactively, refuses a stale environment and takes `--plan` for a
pinned artifact. Needs: the Railway CLI, `npm install railway` (or pnpm) in the
repo so `railway.ts` can be evaluated, and a login or token on the owner's
machine.

ADR 0010 (read in full) does not itself state a rule about cloud credentials in
CI; it only requires a read-only workflow token and gates deploys behind
required checks. The nearest written rule is ADR 0013 line 50 (the backup job
side "never holds AWS credentials", and the ticket cites 0010 for the same
idea). Taking the ticket's reading, a Railway project token in a GitHub secret
would break it, and nothing forces one.

### What the cutoff does if nothing is done

The docs are silent. The only statements are "stop being read" (above). Neither
the deprecation banner, the IaC page, the config-as-code page nor changelogs
0304 and 0312 say whether settings freeze, reset to defaults, fall back to
Railpack, or are copied into the dashboard; changelog 0304 does not even say what
happens to existing services.

Inference, not documented: the docs say file values "will always override
values from the dashboard" and "the settings in the dashboard will not be
updated with the settings defined in code" (<https://docs.railway.com/config-as-code>).
So once the file is not read, the dashboard values apply. The runbook (stage 3)
has the Builder showing Railpack until the config file path is saved, which
suggests the dashboard builder is Railpack and the first deploy after the
cutoff would try to build with Railpack, with no healthcheck and the default
restart policy. The runbook's own stage 6 notes name `turbo run start` and
`/mise/installs/` as the symptom of that fallback.

### Other things the migration touches

- Wait for CI: docs describe it as a service setting that holds new deploys in
  `WAITING` until all GitHub Actions check suites on the commit finish; failed
  workflows skip the deploy; skipped or neutral ones never block; after two
  hours the deploy is skipped.
  <https://docs.railway.com/deployments/github-autodeploys#wait-for-ci>
  (source: `content/docs/deployments/github-autodeploys.md`.) It is a source
  setting, not a `railway.json` one, so the cutoff does not remove it. The
  SDK has `source.checkSuites`, undocumented in the IaC reference. If
  `railway.ts` declares `source`, it would own that flag; omitting `source` is
  documented ("manage service settings but not declare a GitHub repository").
- Monorepo paths: today the services read `/apps/server/railway.json` through
  the Config File setting. The migration clears that field. `rootDirectory` is
  a separate `source` key; the repo builds from the root with a
  `dockerfilePath`, so `rootDirectory` should stay unset.
- A merged `migrate` over both services writes one `.railway/railway.ts`.
  The docs warn that "omitting a resource means deleting it" in a single file,
  and the plan can touch the `database` service, so review plan output.
  <https://docs.railway.com/infrastructure-as-code#multi-repo-projects>
- `railway config plan` redacts variable values; `pull` writes existing
  variables as `preserve()`.

## Per-setting support

Cited as: Ref = IaC reference page, SDK = `railway-ts-sdk` `schema.ts`/`sdk.ts`,
CLI = `railwayapp/cli` source (URLs above). "Documented" means a docs.railway.com page.

| Setting (railway.json)                    | Documented in IaC docs                 | In SDK types and CLI passthrough                 | Carried by `migrate` | Verdict                                       |
| ----------------------------------------- | -------------------------------------- | ------------------------------------------------ | -------------------- | --------------------------------------------- |
| `build.builder: DOCKERFILE`               | No (Ref: `build` is a command string)  | Yes: `build.builder` (SDK schema.ts)             | Yes                  | Supported in IaC, undocumented                |
| `build.dockerfilePath`                    | No                                     | Yes: `build.dockerfilePath`                      | Yes                  | Supported in IaC, undocumented                |
| `build.watchPatterns` (8 server, 9 web)   | No                                     | Yes: `build.watchPatterns`                       | Yes                  | Supported in IaC, undocumented                |
| `deploy.healthcheckPath` (`/health`, `/`) | Yes: `healthcheck` (Ref, Healthchecks) | Yes                                              | Yes                  | Supported and documented                      |
| `deploy.restartPolicyType: ON_FAILURE`    | No                                     | Yes: `deploy.restartPolicyType` (+ `MaxRetries`) | No (dropped)         | In IaC schema, undocumented; migrate loses it |
| `deploy.drainingSeconds: 10` (server)     | No                                     | Yes: `deploy.drainingSeconds`                    | No (dropped)         | In IaC schema, undocumented; migrate loses it |

Reading of the ticket's claim: refuted for tooling (all three have fields), confirmed
for documentation, and confirmed for `migrate` as regards restart policy and
draining time. Whether `apply` really writes these keys to a live service was
not tested; "supported" rests on the SDK types and the CLI compiler's
passthrough, not on a doc page or a run. The CLI also has a non-IaC route to
the same keys, `deploy.restartPolicyType` in `railway environment edit`
(`src/controllers/config/patch.rs`); that command was not read in depth.

## Assessment

The ticket's premise is half right. No documented IaC option covers four of the
six settings, but the SDK and CLI accept `build` and `deploy` objects that do,
and `railway config migrate` would carry the Dockerfile builder, path and watch
patterns but drop restart policy and draining time. A plan that ends with
`ON_FAILURE` and `drainingSeconds: 10` needs them added to `railway.ts` by hand
and checked in a `plan`, because only the owner can see what the live service
holds.

CI is not needed: plan and apply run locally with the owner's login, which
keeps ADR 0010's stance intact. Avoid the GitHub Action and the `RAILWAY_TOKEN`
secret.

Doing nothing is the dangerous option. The docs promise only that the files
stop being read; the likely outcome is a dashboard-default Railpack build, so
migrating before 2026-12-01 is required, not tidy-up. Use `migrate` without
`--apply` to preview, then `cutover` right before the final apply, since it
redeploys and keeps a reversible snapshot.

The documented-only fallback is the dashboard for restart policy and draining
time, recorded in the repo (runbook), as the ticket already anticipates. That
choice, and relying on undocumented fields, is for the decision checkbox.

## Open questions

- Does `apply` write `deploy.restartPolicyType` and `deploy.drainingSeconds`
  to a service, and does `plan` show drift on them afterwards? Test on a
  throwaway project before touching production.
- Are fields omitted from `railway.ts` (for example `source`, the Wait for CI
  flag) left alone, or reset, when a single-file plan covers the service? The
  docs describe deletion only for omitted resources.
- Exact cutoff behavior for services that never migrated: Railway docs are
  silent (see above); Railway support or a staging service is the only way to
  find out.
- The docs contradict the changelog on whether `migrate --apply` clears the
  Config File field.
- The IaC page says IaC is generally available while its limitations list is
  shorter than the CLI's migrate options; the reference omits `build`/`deploy`
  objects. Re-read the reference before applying; the docs may catch up.
- Community forum answers mention the same dates and a 2026-08-28 start for
  new projects; not used here, as they are not primary.
