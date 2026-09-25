# 04: Provision Railway and deploy the trial

Read `../spec.md` first.

**What to build:** The Railway project, services, domains, and variables from
the spec, deployed from `main`, with the owner's account created and public
sign-up then switched off.

**Blocked by:** 01, 02, 03

**Status:** ready-for-human

**Notes:** Account, billing, DNS, and secrets are the owner's to handle. An
agent can prepare a step-by-step walkthrough (the `/wizard` skill) but does
not enter credentials.

- [ ] Hobby plan; project in Singapore; PostgreSQL 18 service with no public TCP proxy left enabled.
- [ ] api and web services point their Railway config file setting at `/apps/server/railway.json` and `/apps/web/railway.json` (absolute from the repo root); the first build finds each Dockerfile, or the `dockerfilePath` fix is noted under Comments.
- [ ] web service variable `VITE_API_ORIGIN` is set before its first build.
- [ ] GitHub auto-deploy on `main` waits for CI; app sleeping is off for api.
- [ ] CNAMEs for `bookkeeping.boonyarit.me` and `api.bookkeeping.boonyarit.me` added at Hostinger; both serve over HTTPS; the apex personal site still works.
- [ ] Variables set per the spec, including `AUTH_RATE_LIMIT_ENABLED=false`; `BETTER_AUTH_SECRET` generated fresh, never reused from local.
- [ ] Schema applied with `pnpm db:push` through a temporary TCP proxy, then the proxy disabled.
- [ ] On the phone: install the PWA, sign up, record and edit a transaction, sign out and back in.
- [ ] `AUTH_SIGN_UP_ENABLED=false` set and deployed; a second sign-up attempt is rejected.
- [ ] After one week of use, the Railway usage and the first-save-after-idle latency are noted under Comments.
