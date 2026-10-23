# 01: Confirm the queued `main` deploys went live

Read `../spec.md` first (Impact).

**What to build:** Once Railway re-enables Hobby builds, production api and web
run the code from #39, #37 and #40, which merged while builds were paused.

**Blocked by:** None (can start immediately). Railway must first re-enable
builds for Hobby workspaces.

**Status:** ready-for-human

**Notes:** Railway asked customers not to re-trigger queued deployments. Wait
for the queue first, and redeploy by hand only if it dropped them.

- [ ] Railway's status page shows Hobby builds enabled.
- [ ] api and web each have an active deployment built from the commit of #40, or a later `main` commit.
- [ ] api `/health` returns `{"status":"ok"}` and the web app loads on the phone.
- [ ] Recording a transaction from the phone works.

## Comments

**2026-10-23, 01:15 UTC (agent):** Railway's status page shows Hobby builds
re-enabled at 21:59 UTC on 2026-10-22, and every plan at normal speed by
23:22 UTC. The queue did not deploy the paused merges. Railway's newest GitHub
deployment for `bookkeeping / production` is `6f19fb8` (#36), which succeeded
at 15:07 UTC on 2026-10-20. `467c517` (#39), `95320c2` (#37) and `0cd87f9`
(#40) have no deployment and no commit status. Web's `last-modified` header
(15:05 UTC on 2026-10-20) agrees. Production is still up: api `/health`
returns `{"status":"ok"}` and web `/` returns 200. The next step is a manual
**Deploy Latest Commit** on api and web, from the dashboard's command palette,
since Railway reported plain Redeploy failing during the incident.
