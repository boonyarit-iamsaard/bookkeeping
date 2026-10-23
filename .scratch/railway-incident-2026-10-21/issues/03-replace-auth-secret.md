# 03: Replace `BETTER_AUTH_SECRET`

Read `../spec.md` first (Impact, Decisions).

**What to build:** api signs sessions with a freshly generated secret, so every
session signed with the old one, forged or real, stops working.

**Blocked by:** 02

**Status:** done

**Notes:** Generate the secret the way the deployment runbook's stage 4 does,
straight to the clipboard, and clear the clipboard afterwards. Never reuse a
local secret.

- [x] A new 32-byte secret is set as `BETTER_AUTH_SECRET` on api, and api is redeployed.
- [x] The phone's old session is signed out; signing in again and recording a transaction works.
- [x] api deploy logs show no auth errors after the sign-in.

## Comments

**2026-10-23, 02:34 UTC (agent):** The owner generated a new 32-byte secret
straight to the clipboard (`openssl rand -base64 32 | tr -d '\n' | clip.exe`),
replaced only `BETTER_AUTH_SECRET` on api. api
deployment `f1ca1630` (`0cd87f9`) reached `SUCCESS` at 02:32 UTC, and
`/health` returns `{"status":"ok"}`. The phone app signed out on its own, and
signing in and recording a transaction then worked. The deployment's logs
show only `Server listening`, with no auth errors before or after the sign-in.

**2026-10-23 (owner):** The clipboard is cleared.

**Closed:** sessions signed with the old secret no longer work.
