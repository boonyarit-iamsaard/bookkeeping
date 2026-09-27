# Runbook: provision Railway and deploy the trial

Step-by-step instructions for
[04-provision-railway-and-first-deploy](issues/04-provision-railway-and-first-deploy.md).
Read [the spec](spec.md) first. Work through the stages in order: several of
them depend on an earlier stage being finished.

Every value in this runbook goes into the Railway dashboard or Hostinger. Do
not write any of it to a local `.env` file or a GitHub secret.

Steps marked **UI may differ** describe a screen I could not confirm. If what
you see differs, follow the intent of the step and note the real path under the
ticket's Comments.

## Before you start

- A GitHub account with access to `boonyarit-iamsaard/bookkeeping`.
- A login for Hostinger hPanel, which holds DNS for `boonyarit.me`.
- Your phone, on mobile data rather than Wi-Fi, for stage 11.
- A terminal at the repo root with `curl` and `pnpm`: PowerShell 7 on Windows,
  or Bash with `openssl` on macOS or Linux.
- Allow about an hour. Most of it is waiting on builds, DNS, and certificates.

Reference values used throughout:

| Name             | Value                          |
| ---------------- | ------------------------------ |
| Web hostname     | `bookkeeping.boonyarit.me`     |
| API hostname     | `api.bookkeeping.boonyarit.me` |
| Region           | Southeast Asia (Singapore)     |
| api config file  | `/apps/server/railway.json`    |
| web config file  | `/apps/web/railway.json`       |
| Postgres service | `Postgres`, major version 18   |

## Stage 1: Railway account on the Hobby plan

The budget is $10 a month. The trial should cost $6–8.

1. Open <https://railway.com/dashboard>.
2. Sign in with GitHub, using the account that owns the repository.
3. Open billing or plans and choose **Hobby**. **UI may differ:** this is under
   account settings or workspace settings.

- [x] The Hobby plan is active.

## Stage 2: Project and PostgreSQL 18 in Singapore

1. Open <https://railway.com/new> and create an **Empty Project**.
2. Rename the project `bookkeeping`. Keep the default environment,
   `production`.
3. On the canvas, choose **Create → Database → PostgreSQL**.
4. Rename the new service to exactly `Postgres`. Stage 4 refers to it by this
   name.
5. Open **Postgres → Settings → Source** and check the image tag is `18`, for
   example `…/postgres-ssl:18`. If the template installed another major
   version, change the tag to `18` now, before any data exists.
6. Open **Postgres → Settings → Deploy → Regions** and choose **Southeast Asia
   (Singapore)**.
7. Open **Postgres → Settings → Networking**. If there is a **TCP Proxy**,
   delete it. The database should be reachable only over the private network.

- [x] Postgres 18 is running in Singapore.
- [x] Postgres has no TCP proxy.

## Stage 3: api service settings

Create the service **empty** and connect the repository only in stage 6.
Otherwise Railway builds it straight away, before its variables exist.

1. On the canvas, choose **Create → Empty Service**. Rename it `api`.
2. **api → Settings → Config-as-code → Railway Config File**:
   `/apps/server/railway.json`. The path is absolute from the repo root.
3. **api → Settings → Deploy → Regions**: Southeast Asia (Singapore).
4. **api → Settings → Deploy → Serverless** (app sleeping): **off**.
5. Deploy the staged changes. Until you do, the service exists only as a draft
   and none of these settings are saved. Hold **Alt** while clicking
   **Deploy** to save without triggering a redeploy. With no repository
   connected yet, nothing builds.
6. **api → Settings → Build → Builder** should now show **Dockerfile**. If it
   still shows Railpack, the config file path was not saved: enter it again
   and deploy the change. Do not continue until it shows Dockerfile.

- [x] The api service points at `/apps/server/railway.json`.
- [x] App sleeping is off for api.

## Stage 4: api service variables

1. Generate a fresh auth secret in your terminal. Never reuse the one in your
   local `apps/server/.env`. In PowerShell 7:

   ```powershell
   [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) | Set-Clipboard
   ```

   On macOS:

   ```sh
   openssl rand -base64 32 | pbcopy
   ```

   Either one puts the secret on your clipboard without printing it. On
   Windows, if Clipboard history (**Win+V**) is on, the secret stays in that
   list: delete the entry once it is pasted.

2. Open **api → Variables → Raw Editor** and paste this block. Replace
   `<paste-secret>` with the secret from your clipboard:

   ```sh
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   BETTER_AUTH_URL=https://api.bookkeeping.boonyarit.me
   CLIENT_ORIGINS=https://bookkeeping.boonyarit.me
   BETTER_AUTH_SECRET=<paste-secret>
   AUTH_RATE_LIMIT_ENABLED=false
   AUTH_SIGN_UP_ENABLED=true
   ```

3. Click **Update Variables**.
4. Check that `DATABASE_URL` resolves to a private host ending in
   `.railway.internal`. If it shows an empty or unresolved value, the database
   service isn't named `Postgres`: fix the reference to match its name.
5. Clear the secret from your clipboard: `Set-Clipboard -Value ' '` in
   PowerShell, or copy something else.
6. Deploy the staged variables before stage 6. A deploy triggered by
   connecting the repository uses only variables that were already applied.

Do not set `PORT` or `HOST`. Railway sets `PORT` for you, and the server
already listens on `0.0.0.0`.

- [x] All six variables are set on api.
- [x] `BETTER_AUTH_SECRET` was generated fresh.

## Stage 5: web service settings and build variable

`VITE_API_ORIGIN` is baked into the bundle at build time.
`apps/web/Dockerfile` fails the build if it is missing, so set it **before**
the first build.

1. On the canvas, choose **Create → Empty Service**. Rename it `web`.
2. **web → Settings → Config-as-code → Railway Config File**:
   `/apps/web/railway.json`.
3. **web → Settings → Deploy → Regions**: Southeast Asia (Singapore).
4. **web → Variables → Raw Editor**, paste and save:

   ```sh
   VITE_API_ORIGIN=https://api.bookkeeping.boonyarit.me
   ```

5. Deploy the staged changes, then check that **web → Settings → Build →
   Builder** shows **Dockerfile**, as in stage 3.

- [x] The web service points at `/apps/web/railway.json`.
- [x] `VITE_API_ORIGIN` is set on web.

## Stage 6: Connect GitHub and deploy `main`

Do these steps for **api** first, then for **web**:

1. **Service → Settings → Source → Connect Repo**: choose
   `boonyarit-iamsaard/bookkeeping`.
2. Set the branch to `main`.
3. Turn on the option that makes deploys wait for CI. **UI may differ:** its
   label is something like **Wait for CI** or check suites.
4. Deploy the service, or apply the staged changes, and watch the build logs.

Then check the results:

- api is healthy once its deploy passes the `/health` healthcheck.
- web is healthy once its deploy goes green.
- If the logs show `turbo run start` or `/mise/installs/`, Railway built with
  Railpack instead of the Dockerfile: the config file path was not applied.
  Re-enter it, deploy, and redeploy the service.
- If the server exits with a `ZodError` naming missing variables, the deploy
  started before the variables were applied. Deploy any staged changes, then
  redeploy.
- If a build fails because it can't find the Dockerfile, fix `dockerfilePath`
  in that service's `railway.json` and note the fix under the ticket's
  Comments.

- [x] Both services deployed from `main`.
- [x] Auto-deploy waits for CI on both services.

## Stage 7: Custom domains in Railway

1. **api → Settings → Networking → Custom Domain**: enter
   `api.bookkeeping.boonyarit.me`. If it asks for a port, accept the one it
   detects: the api logs `8080`, the `PORT` Railway assigns it.
2. Write down the CNAME target Railway shows, something like
   `xxxx.up.railway.app`.
3. **web → Settings → Networking → Custom Domain**: enter
   `bookkeeping.boonyarit.me`, and write down its CNAME target.
4. If Railway also lists a **TXT** verification record for either domain,
   write that down too.

| Hostname                       | Type  | Name                              | Value                                     |
| ------------------------------ | ----- | --------------------------------- | ----------------------------------------- |
| `api.bookkeeping.boonyarit.me` | CNAME | `api.bookkeeping`                 | `<api CNAME target from Railway>`         |
| `api.bookkeeping.boonyarit.me` | TXT   | `_railway-verify.api.bookkeeping` | `railway-verify=<api token from Railway>` |
| `bookkeeping.boonyarit.me`     | CNAME | `bookkeeping`                     | `<web CNAME target from Railway>`         |
| `bookkeeping.boonyarit.me`     | TXT   | `_railway-verify.bookkeeping`     | `railway-verify=<web token from Railway>` |

## Stage 8: DNS at Hostinger

1. Open <https://hpanel.hostinger.com/domain/boonyarit.me/dns>. **UI may
   differ:** otherwise go to **hPanel → Domains → boonyarit.me → DNS /
   Nameservers**.
2. Add each record from the stage 7 table, copying its **Type**, **Name**,
   and **Value**. Hostinger fills in the domain, so enter the **Name** as
   written, without `.boonyarit.me`. Paste TXT values in full, including the
   `railway-verify=` prefix.
3. **Do not touch** the apex (`@`) or `www` records. The personal site depends
   on them.

- [x] Both CNAMEs are added at Hostinger.
- [x] Both TXT records are added at Hostinger.

## Stage 9: HTTPS on both hostnames

DNS and Railway's certificates can take from a few minutes to about an hour.
Check from PowerShell 7:

```powershell
foreach ($u in 'https://api.bookkeeping.boonyarit.me/health', 'https://bookkeeping.boonyarit.me/', 'https://boonyarit.me/') { "$(curl -sS -o NUL -w '%{http_code}' $u)  $u" }
```

On macOS or Linux, run the same `curl` against each URL with `-o /dev/null`
instead of `-o NUL`.

All three should print `200`. Certificate errors mean Railway hasn't issued the
certificate yet: wait and try again. The Custom Domain section in Railway
shows when it has issued the certificate.

- [x] Both hostnames serve over HTTPS.
- [x] The apex personal site still works.

## Stage 10: Apply the schema through a temporary TCP proxy

1. **Postgres → Settings → Networking → TCP Proxy**: enable it on port `5432`.
2. **Postgres → Variables**: copy `DATABASE_PUBLIC_URL`.
3. From the repo root, run `db:push` with that URL. Don't save it to
   `packages/database/.env`. Reading it at a prompt also keeps it out of your
   shell history. In PowerShell 7:

   ```powershell
   $env:DATABASE_URL = Read-Host -MaskInput 'DATABASE_PUBLIC_URL'; pnpm db:push; Remove-Item Env:DATABASE_URL
   ```

   In Bash:

   ```sh
   read -rs DATABASE_URL && DATABASE_URL="$DATABASE_URL" pnpm db:push; unset DATABASE_URL
   ```

   Paste the URL when the prompt waits; it is masked or hidden. A
   `DATABASE_URL` already in the environment takes precedence over the local
   `packages/database/.env`, so the push targets Railway. Don't use
   `--force`. If drizzle-kit asks about anything destructive, stop and check
   first.

4. **Postgres → Settings → Networking**: delete the TCP proxy again.

- [x] The schema is applied with `pnpm db:push`.
- [x] The TCP proxy is gone.

## Stage 11: Phone trial, then close sign-up

On your phone, over mobile data:

1. Open <https://bookkeeping.boonyarit.me>.
2. Install the PWA: **Share → Add to Home Screen** on iOS, or **Install app**
   on Android.
3. Open the installed app and sign up with your real account.
4. Record a transaction, then edit it.
5. Sign out, then sign back in.

- [x] Every step above worked on the phone.

Now close public sign-up:

1. **api → Variables**: set `AUTH_SIGN_UP_ENABLED=false`, then deploy the
   change.
2. Once the redeploy is live, open the sign-in screen. It should show neither
   the "Don't have an account?" text nor a "Sign up" link. Open `/sign-up`; it
   should land on `/sign-in`. Or check from PowerShell 7:

   ```powershell
   curl -sS -o NUL -w '%{http_code}' -X POST https://api.bookkeeping.boonyarit.me/api/auth/sign-up/email -H 'Content-Type: application/json' -H 'Origin: https://bookkeeping.boonyarit.me' --data '{"email":"probe@example.com","password":"probe-password-123","name":"probe"}'
   ```

   Or from Bash:

   ```sh
   curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
     https://api.bookkeeping.boonyarit.me/api/auth/sign-up/email \
     -H 'Content-Type: application/json' \
     -H 'Origin: https://bookkeeping.boonyarit.me' \
     --data '{"email":"probe@example.com","password":"probe-password-123","name":"probe"}'
   ```

   A non-2xx status means sign-up is closed. A `200` means it's still open, and
   the test request just created an account: delete it, then check the variable
   and redeploy.

3. Sign in again on the phone to confirm your own account still works.

- [x] `AUTH_SIGN_UP_ENABLED=false` is deployed.
- [x] A second sign-up is rejected.

## One week later

Under the ticket's Comments, note:

- Railway usage for the week, from **Workspace → Usage**, against the $10
  budget.
- How long the first save takes after the app has been idle.

- [ ] Usage and latency noted.
