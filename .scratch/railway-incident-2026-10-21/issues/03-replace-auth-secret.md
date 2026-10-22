# 03: Replace `BETTER_AUTH_SECRET`

Read `../spec.md` first (Impact, Decisions).

**What to build:** api signs sessions with a freshly generated secret, so every
session signed with the old one, forged or real, stops working.

**Blocked by:** 02

**Status:** ready-for-human

**Notes:** Generate the secret the way the deployment runbook's stage 4 does,
straight to the clipboard, and clear the clipboard afterwards. Never reuse a
local secret.

- [ ] A new 32-byte secret is set as `BETTER_AUTH_SECRET` on api, and api is redeployed.
- [ ] The phone's old session is signed out; signing in again and recording a transaction works.
- [ ] api deploy logs show no auth errors after the sign-in.
