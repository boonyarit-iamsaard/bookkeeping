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
