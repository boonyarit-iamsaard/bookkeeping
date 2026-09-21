# 05: Port wallets

Read `../worker-brief.md` first.

**What to build:** The wallets list with its display-figure total, the
create-wallet form, and wallet management (opening correction,
archive/unarchive, permanent deletion with confirmation), exactly as the
legacy app and `DESIGN.md` describe them. Because this is the first `/v1`
write, this ticket also proves the reliability behaviour in the browser:
double-tap Save creates one wallet, and a lost response replays without a
duplicate. The new suite joins CI's browser step; the legacy wallet specs
are retired.

**Blocked by:** 04: Port sign-in and sign-up

**Status:** done

**Pattern to copy:**

- Legacy `features/wallets` in full: list, row, type icon, `Money`,
  create form + schema + hook, management component, labels. Replace the
  Server Actions with `useApiMutation` calls and the page-level data loads
  with route loaders that `ensureQueryData` the wallet query options.
- The `?created=<id>` arrival fade-in stays.
- Routes: `/wallets`, `/wallets/new`, `/wallets/$walletId`.
- Browser specs: port the scenarios of the legacy `wallets.spec.ts` and
  `wallet-lifecycle.spec.ts` one for one, plus two new scenarios: click Save
  twice quickly and assert one wallet; abort the create response once (route
  interception) and assert the replay lands one wallet with no error shown.
- CI: extend the workflow's Playwright install and `ci:e2e` step to the new
  package (the legacy step stays until ticket 13).

**Out of scope:** dashboard balances-on-a-date (11); changing any wallet
rule (refund allowance, archive constraints are server-owned); redesigning
the row or management layout.

- [x] `/wallets` shows the total, count caption, rows with pictogram, name, type, opened date (from 640px), and right-aligned balance; archived wallets keep their figures.
- [x] Create wallet validates as before, preserves values on rejection, shows the server error bar on a non-field problem, and returns to the list with the new row highlighted.
- [x] Management performs opening correction, archive, unarchive, and delete with the same confirmation flow and messages.
- [x] Double-tap Save and lost-response replay each yield exactly one wallet.
- [x] `wallets.spec.ts` and `wallet-lifecycle.spec.ts` exist in the new suite and pass on `phone-chromium`; the legacy copies are deleted.
- [x] The CI workflow runs the new suite's `ci:e2e`.
- [x] `pnpm run ci` is green.

**Verify:** `pnpm run ci`; `pnpm --filter @bookkeeping/web test:e2e -- --project=phone-chromium wallets wallet-lifecycle`.

## Comments

Ported the wallet list, create form, wallet management screen, API-backed
queries and mutations, exact money display, arrival highlight, and the two
idempotency reliability workflows into `apps/web`. Added the SPA Playwright
wallet and lifecycle specs, retired both legacy wallet specs, and ran the new
browser suite sequentially in CI beside the legacy suite.

The legacy lifecycle assertions that navigate to `/transactions/new` remain
deferred to the transaction-entry ticket because that route is not part of
this wallet port; archive/unarchive, retained figures, opening correction,
and deletion confirmation/error behavior are covered here.
