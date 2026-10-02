# 07: Sign-in and sign-up

Read `../design-brief.md` first, then the `DESIGN.md` written by 01.

**What to build:** Signing in and signing up happen on the new system. The
signed-out layout, the sign-in form, the sign-up form, the closed sign-up
state, and their errors are in 01's language, in light and dark.

**Blocked by:** 01 (Foundation: system, shell and Home)

**Status:** done

- [x] The signed-out layout uses 01's ground and surfaces, with the Bookkeeping name and no borrowed bank marks.
- [x] Sign-in and sign-up forms are on the new system; inputs and submit buttons keep 44px phone targets.
- [x] Closed sign-up still reads as closed, with existing Accounts able to sign in.
- [x] Credential and validation errors render on the new system without clearing entered values; red is never the only signal.
- [x] Returning to the requested page after sign-in still works.
- [x] `DESIGN.md` changes only through a stated system change, recorded in this ticket's closing comment.

## Constraints

- Visual only: no API, schema, or backend change. Charts use only `/v1/reports/monthly` and wallet as-of balances. Level 3 (spending by category, balance over time) is out of scope; never fake it with client-side sums.
- Behavior, routes, copy, domain vocabulary (`CONTEXT.md`), and accessible names stay as they are. Existing unit and browser tests keep passing without their assertions being rewritten to fit.
- Every phone control keeps a 44 by 44 CSS pixel target; transaction type, sign, and direction never rely on red or green alone; motion is removed under reduced motion. Check at 360px and from 640px, in light and dark.
- Never use production data in screenshots, comps, or fixtures; sample money is clearly placeholder.

**Verify:** `pnpm run ci`, then the auth spec alone on one project (`phone-chromium`). Follow the local resource limits in `CLAUDE.md`.

## Closing comment

Done in the commit `feat(accounts): rebuild sign-in and sign-up on the new
system`. The signed-out layout is the ground with the app mark and the
Bookkeeping wordmark above one Form Card in the 448px column (28px padding
from 640px), with the Headline as the card title. Both forms keep their
fields on the shared 44px field surface and the submit button is the `lg`
Iris primary, the screen's one action. A credential rejection is now the
shared Error Notice instead of a bare field error; field errors already
carried 02's pictogram and keep it. Values stay through both kinds of error.

`DESIGN.md` is unchanged: nothing was added to the system, and the
signed-out composition is the screen-specific part its scope paragraph
leaves out. No new component was needed.

Inspected in one batched round at 360px light and dark, and at desktop widths
in light and dark, on a throwaway local account: sign-in, sign-up, wrong
credentials, field validation with values kept, and closed sign-up (a second
local API with sign-up disabled: `/sign-up` redirects to sign-in, which shows
no Sign up link). The pane's capture came back tiled or clipped, so the 1280px
frame was checked by measurement (448px card centred, 28px padding) and
captured at 720px wide instead. `pnpm run ci` and `auth.spec.ts` on
`phone-chromium` pass.

Found while checking "returning to the requested page": the app does not do
this and never did. The guard redirects to `/sign-in` without remembering the
path, and sign-in always lands on Home (visiting `/wallets` signed out ends on
`/`). Building it would be a behavior change, outside this visual-only ticket,
so the box is ticked for "no regression" and the feature is left as a
follow-up.
