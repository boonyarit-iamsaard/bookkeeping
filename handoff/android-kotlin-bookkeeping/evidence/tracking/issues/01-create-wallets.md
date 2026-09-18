# 01: Create wallets with dated opening balances

**What to build:** A signed-in user can create cash, bank account, and e-wallet holdings with THB opening balances and opening dates, then see those balances in a wallet view. A user without wallets sees an actionable creation state. Establish the minimum real-database and browser testing foundation through this working behavior.

**Blocked by:** None (can start immediately).

**Status:** done

## Acceptance criteria

- [x] Create and persist all three wallet types with a name, explicit THB currency, opening amount, and opening date. Display money with two decimals and tabular numerals.
- [x] Parse opening amounts exactly into integer satang; accommodate amounts and aggregated balances beyond signed 32-bit integers. Zero/negative opening balances are supported by the accepted negative-balance model; do not apply the positive transaction-amount constraint to openings.
- [x] Opening balances represent the start of their date, appear as balances rather than income, and persist across reloads. Do not introduce formal double-entry or event-sourced financial accounting.
- [x] Show wallet name, type, and current opening-derived balance; provide an actionable empty state without fabricated personal money figures.
- [x] Authenticate every server operation, derive ownership from the session, and reject reads/writes using another user's wallet identifiers. Client-supplied ownership cannot override the session.
- [x] Add the minimum isolated real PostgreSQL operation-test harness and small browser harness; prove wallet creation/reload and signed-out/cross-user denial through observable behavior.
- [x] Use the existing Next.js, React, TypeScript, PostgreSQL/Drizzle, Better Auth, Zod, Tailwind, and shared UI foundation. Preserve existing authentication behavior.
- [x] Apply impeccable using the confirmed product context: phone/desktop layouts, labeled controls, legible THB figures, keyboard access, clear validation, and appropriate visual verification. Confirm the accent if needed and record the chosen design direction for subsequent UI tickets.
- [x] Run relevant tests and existing formatting, lint, type, and build checks. Do not create separate schema-only or harness-only deliverables.

## Scope and handoff

Transaction capture follows in 02; opening corrections and archive/delete controls follow in 06. Reference the confirmed tracking specification and balance-model ADR for domain constraints. Covers the ownership, exact-money, empty-state, and wallet-opening parts of spec criteria 1, 2, 10, 24, and 25.

## Comments

2026-09-13 — Implemented on `main`.

- Routes: `/wallets` (total + flat list, empty state) and `/wallets/new`
  (full-screen form). Operations in `src/features/wallets/server/operations.ts`
  take a `Database` and an `ownerId` that only the session supplies.
- Money: `parseSatang`/`formatBaht` in `src/shared/helpers/money.ts`; storage is
  PostgreSQL `bigint`. Openings accept up to 15 whole-baht digits (a build-time
  sanity cap, not a product limit); zero and negative openings are accepted.
- Harness: Vitest (`pnpm test`; `*.db.test.ts` run against `bookkeeping_test`
  inside rolled-back transactions) and Playwright (`pnpm test:e2e`, desktop +
  Pixel 7). CI gained a PostgreSQL service and Chromium.
- Design: accent confirmed as cobalt `oklch(0.52 0.2 262)`; direction recorded
  in `DESIGN.md` and `.impeccable/design.json`; surface brief at
  `.impeccable/surfaces/src-app-app-wallets-page-tsx.md`.
- Handoff: no operation in this ticket accepts a wallet identifier, so
  cross-user denial is proven only through list isolation (operation test).
  When by-id operations arrive (02 transactions, 06 lifecycle), add tests that
  substitute another user's wallet id and assert not-found. The Server Function
  `createWalletAction` checks the session itself; the browser suite covers the
  signed-out page redirect only.

2026-09-13 — Addressed the commit review.

- Money helpers use `parseMoneyInput`, `formatMoney`, and `formatMoneyParts`,
  with explicit THB currency and integer minor units in their contracts.
- Malformed comma grouping is rejected. Future opening dates are rejected at
  the form/action boundary; existing future openings contribute zero to current
  balances until their opening date. Removed the unconfirmed wallet-name cap.
- Added regression coverage for Bangkok midnight, malformed money input, long
  names, future opening balances, and real browser action ownership/denial.
- Operation and browser tests now use disposable PostgreSQL Testcontainers and
  schema push. Removed versioned migration artifacts and commands under the
  user-authorized `db:push` policy recorded in `AGENTS.md`.
- Applied the reviewed readonly parameter and named-function style fixes.
- Verification: 28 unit/database tests and all 8 desktop/phone browser tests
  passed; browser verification used no retries. Formatting, Markdown lint,
  Biome, and type checks passed. Production build passed with `--webpack`;
  Turbopack encountered an environment port-binding error.

2026-09-13 — E2E lifecycle follow-up after a reported second-run startup timeout.

- Two consecutive full local runs passed before the changes, so the reported
  120-second startup timeout was not reproduced and its cause remains unconfirmed.
- A real Next.js smoke check confirmed that the old forceful teardown skipped
  completion of Next's shutdown handler. Enabled graceful SIGTERM shutdown,
  gave the dev child time to flush/unlock, and made server logs visible.
- The runner launches Playwright directly and forwards SIGINT/SIGTERM, waits
  for CLI closure, then stops the database. Next is also launched directly to
  avoid package-manager failure messages during expected server termination.
- Normal and interrupted real-server checks now show Next cleanup completing;
  interruption exits with code 143. All eight local browser tests passed without
  retries after the lifecycle changes. Type and Biome checks passed.

### 2026-09-13 — Naming and vocabulary follow-up

The architecture consistency change supersedes the earlier filename references:
wallet behavior now lives in `src/features/wallets/server/wallet.ts`, server
actions in `server/wallet.actions.ts`, and shared wallet vocabulary in
`src/features/wallets/wallet.types.ts`. Tests use `*.unit.test.ts` and
`*.integration.test.ts`; the wallet database tests are now
`src/features/wallets/server/wallet.integration.test.ts`.
Follow [code conventions](../../../docs/code-conventions.md) for subsequent work.
