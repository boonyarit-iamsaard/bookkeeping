# 06: Move the server and web services off Railway config as code

Read `../spec.md` first, and `docs/adr/0010-protected-main-and-gated-deploys.md`
(Railway waits for CI).

**What to build:** Before Railway stops reading `railway.json` on
2026-12-01, the api and web services keep every setting their config files
apply today, through whichever replacement fits: Railway's Infrastructure as
Code (`.railway/railway.ts`, applied with the Railway CLI) or the dashboard.

**Blocked by:** none

**Status:** needs-triage

**Notes:** Found on 2026-10-18 while writing production-backups 04, whose
`backup` service uses dashboard settings because new services cannot opt
into config as code
(`../../production-backups/issues/04-nightly-backup-job.md`, Comments).
Railway's docs (`infrastructure-as-code.md` in `railwayapp/docs`) mark config
as code deprecated and name 2026-12-01 as the hard cutoff. Railway's
`railway config migrate` writes a `.railway/railway.ts` from the existing
files. From the docs read so far, the IaC `service()` options have no restart
policy, Dockerfile path or draining time, so some settings may have to move
to the dashboard instead. A settings change that only lives in the dashboard
leaves no record in the repository, so whatever moves there is written down
somewhere in the repository.

What the files apply today:

- `apps/server/railway.json`: Dockerfile builder, `dockerfilePath`, eight
  watch patterns, health check `/health`, restart policy `ON_FAILURE`,
  `drainingSeconds: 10`.
- `apps/web/railway.json`: Dockerfile builder, `dockerfilePath`, nine watch
  patterns (including `/apps/server/**`), health check `/`, restart policy
  `ON_FAILURE`.

- [ ] Research recorded under Comments, from Railway's current docs: what IaC supports for these settings, how `railway config plan` and apply authenticate and whether they would ever run in CI (ADR 0010 keeps cloud credentials out of CI), and what happens to a service's settings at the cutoff if nothing is done.
- [ ] Decision recorded: IaC, dashboard, or a mix, per setting.
- [ ] Owner: the change applied to both services before 2026-12-01; the next deploy of each still waits for CI, finds its Dockerfile, skips on unrelated paths and passes its health check.
- [ ] The `railway.json` files removed, or kept only if something still reads them, and the docs that cite them updated (`../railway-runbook.md`, `docs/research/supply-chain-hardening.md`).

## Comments
