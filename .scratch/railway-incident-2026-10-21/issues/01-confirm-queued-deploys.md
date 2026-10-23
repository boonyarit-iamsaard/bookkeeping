# 01: Confirm the queued `main` deploys went live

Read `../spec.md` first (Impact).

**What to build:** Once Railway re-enables Hobby builds, production api and web
run the code from #39, #37 and #40, which merged while builds were paused.

**Blocked by:** None (can start immediately). Railway must first re-enable
builds for Hobby workspaces.

**Status:** done

**Notes:** Railway asked customers not to re-trigger queued deployments. Wait
for the queue first, and redeploy by hand only if it dropped them.

- [x] Railway's status page shows Hobby builds enabled.
- [x] api and web each have an active deployment built from the commit of #40, or a later `main` commit.
- [x] api `/health` returns `{"status":"ok"}` and the web app loads on the phone.
- [x] Recording a transaction from the phone works.

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

**2026-10-23, 01:35 UTC (agent):** The Railway CLI confirms api and web both
run `6f19fb8`, with no deployment for any later commit. Being a Dependabot
merge doesn't explain the skip. Dependabot merges #25, #32, #33 and #34 all
deployed, and #39 was the owner's. Neither do the settings: api and web have
no watch patterns, the trigger is `main` with "wait for CI", and CI passed on
all three commits. Railway seems to have dropped the push webhooks during the
outage. The fix is
`railway redeploy --service <api|web> --commit 0cd87f9e39b332c538103faeae06a82d2140a211`.

**2026-10-23, 01:47 UTC (agent):** The owner ran the `--commit` redeploys at
01:44 UTC. Both api (`058b0ba9`) and web (`0d24d616`) deployments of
`0cd87f9` reached `SUCCESS` by 01:46 UTC. api `/health` returns
`{"status":"ok"}`, its log shows `Server listening` with no errors, and web
serves a build from 01:45:53 UTC. Still open: loading the app and recording a
transaction from the phone.

**2026-10-23 (owner):** The app loads on the phone, and recording a
transaction works.

**Closed:** production api and web run `0cd87f9` (#40). Ticket 02 is
unblocked.
