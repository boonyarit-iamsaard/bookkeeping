# 02: Sign-in offers Sign-up only when it's open

Read `../spec.md` first.

**What to build:** The sign-in screen shows "Don't have an account? Sign up"
only once the web's Sign-up check answers open. While the check is loading,
after it fails, or when Sign-up is closed, the screen doesn't mention Sign-up at
all and shows no closed-state message. The docs describe the new screen
behavior.

**Blocked by:** 01 (Closed Sign-up sends `/sign-up` to sign-in)

**Status:** done

- [x] The sign-in form reads the Sign-up query from ticket 01 and renders its
      "Don't have an account?" text and "Sign up" link only when the answer is
      `"open"`.
- [x] Neither the text nor the link appears while the query is loading, so the
      link never flashes on screen.
- [x] No "Sign-up is closed" notice is added anywhere.
- [x] The README's section on the sign-up switch says that closing Sign-up also
      hides the link and redirects `/sign-up`.
- [x] Step 2 of stage 11 in `.scratch/deployment/railway-runbook.md` describes
      the new behavior: no link on sign-in, and `/sign-up` lands on sign-in.
      The `curl` check stays. `.scratch/deployment/spec.md` is left unchanged.
- [x] One focused auth browser spec on one project passes with Sign-up open,
      and the sign-in screen's link still reaches `/sign-up`.
- [x] Browser check with Sign-up closed, set up as in ticket 01:
  1. Postgres is up via `pnpm db:start`. If Docker Desktop isn't running, stop
     and report it.
  2. `AUTH_SIGN_UP_ENABLED=false` is set in the local `apps/server/.env`.
  3. The `api` and `web` dev servers are started from `.claude/launch.json`.
  4. `/sign-in` shows neither the text nor the link, with a screenshot as proof.
  5. With the `api` dev server stopped, `/sign-in` also shows neither.
- [x] `apps/server/.env` is restored to its previous Sign-up setting. After an
      `api` restart, `/sign-in` shows the link again.
- [x] `pnpm run ci` passes.

## Comments

- Implemented in commit `b494b8b` (`feat: hide sign-up offer when sign-up is closed`).
- Verified with the focused phone-Chromium auth spec (5 passed), open and
  closed local browser checks, and the API-stopped failure check. The closed
  screenshot is at `apps/web/test-results/closed-sign-in.png`; the local
  `apps/server/.env` was restored to its previously unset setting.
- `pnpm run ci` passed with all 13 Turbo checks and both production builds.
