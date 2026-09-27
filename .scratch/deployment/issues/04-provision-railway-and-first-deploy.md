# 04: Provision Railway and deploy the trial

Read `../spec.md` first.

**What to build:** The Railway project, services, domains, and variables from
the spec, deployed from `main`, with the owner's account created and public
sign-up then switched off.

**Blocked by:** 01, 02, 03

**Status:** done

**Notes:** Account, billing, DNS, and secrets are the owner's to handle. An
agent can prepare a step-by-step walkthrough (the `/wizard` skill) but does
not enter credentials.

- [x] Hobby plan; project in Singapore; PostgreSQL 18 service with no public TCP proxy left enabled.
- [x] api and web services point their Railway config file setting at `/apps/server/railway.json` and `/apps/web/railway.json` (absolute from the repo root); the first build finds each Dockerfile, or the `dockerfilePath` fix is noted under Comments.
- [x] web service variable `VITE_API_ORIGIN` is set before its first build.
- [x] GitHub auto-deploy on `main` waits for CI; app sleeping is off for api.
- [x] CNAMEs for `bookkeeping.boonyarit.me` and `api.bookkeeping.boonyarit.me` added at Hostinger; both serve over HTTPS; the apex personal site still works.
- [x] Variables set per the spec, including `AUTH_RATE_LIMIT_ENABLED=false`; `BETTER_AUTH_SECRET` generated fresh, never reused from local.
- [x] Schema applied with `pnpm db:push` through a temporary TCP proxy, then the proxy disabled.
- [x] On the phone: install the PWA, sign up, record and edit a transaction, sign out and back in.
- [x] `AUTH_SIGN_UP_ENABLED=false` set and deployed; a second sign-up attempt is rejected.

## Comments

Provisioned on 2026-09-27 by following
[the runbook](../railway-runbook.md). The trial is live at
`https://bookkeeping.boonyarit.me` with the api at
`https://api.bookkeeping.boonyarit.me`. Closed in
`docs: record the first railway deploy`. The one-week usage and latency note
moved to [05](05-first-week-usage-review.md).

- The first api build ran on Railpack instead of the Dockerfile. The logs
  showed `turbo run start` from the repo root and pnpm under `/mise/installs/`.
  The config file setting had not been saved. Re-entering
  `/apps/server/railway.json` and deploying fixed it; no `dockerfilePath`
  change was needed. The runbook now checks **Build → Builder** shows
  Dockerfile before the repository is connected.
- That same first deploy started before the api variables were applied, so the
  server exited with a `ZodError` for `DATABASE_URL`, `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`, and `CLIENT_ORIGINS`. It started once the variables were
  deployed and the service redeployed.
- The api logged `Server listening on http://0.0.0.0:8080`, the `PORT`
  Railway assigns.
- Custom domains needed a `_railway-verify` TXT record each, alongside the
  CNAME. Stage 7 of the runbook lists them; the values come from Railway.
- HTTPS check on 2026-09-27: `200` from `/health` on the api, from the web
  root, and from `https://boonyarit.me/`.
- `pnpm db:push` through the temporary TCP proxy applied the schema with no
  destructive prompts. The proxy was then deleted and `DATABASE_PUBLIC_URL`
  is gone.
- The phone trial passed over mobile data with the installed PWA. After
  `AUTH_SIGN_UP_ENABLED=false` was deployed, a second sign-up was rejected.
- The Windows steps (secret generation, HTTPS checks, `db:push`, sign-up
  probe) are in the runbook alongside the Bash ones.
