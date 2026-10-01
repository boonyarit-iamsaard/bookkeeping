# 07: Sign-in and sign-up

Read `../design-brief.md` first, then the `DESIGN.md` written by 01.

**What to build:** Signing in and signing up happen on the new system. The
signed-out layout, the sign-in form, the sign-up form, the closed sign-up
state, and their errors are in 01's language, in light and dark.

**Blocked by:** 01 (Foundation: system, shell and Home)

**Status:** ready-for-agent

- [ ] The signed-out layout uses 01's ground and surfaces, with the Bookkeeping name and no borrowed bank marks.
- [ ] Sign-in and sign-up forms are on the new system; inputs and submit buttons keep 44px phone targets.
- [ ] Closed sign-up still reads as closed, with existing Accounts able to sign in.
- [ ] Credential and validation errors render on the new system without clearing entered values; red is never the only signal.
- [ ] Returning to the requested page after sign-in still works.
- [ ] `DESIGN.md` changes only through a stated system change, recorded in this ticket's closing comment.

## Constraints

- Visual only: no API, schema, or backend change. Charts use only `/v1/reports/monthly` and wallet as-of balances. Level 3 (spending by category, balance over time) is out of scope; never fake it with client-side sums.
- Behavior, routes, copy, domain vocabulary (`CONTEXT.md`), and accessible names stay as they are. Existing unit and browser tests keep passing without their assertions being rewritten to fit.
- Every phone control keeps a 44 by 44 CSS pixel target; transaction type, sign, and direction never rely on red or green alone; motion is removed under reduced motion. Check at 360px and from 640px, in light and dark.
- Never use production data in screenshots, comps, or fixtures; sample money is clearly placeholder.

**Verify:** `pnpm run ci`, then the auth spec alone on one project (`phone-chromium`). Follow the local resource limits in `CLAUDE.md`.
