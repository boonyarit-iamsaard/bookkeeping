# 01: Create wallets with dated opening balances

**What to build:** A signed-in user can create cash, bank account, and e-wallet holdings with THB opening balances and opening dates, then see those balances in a wallet view. A user without wallets sees an actionable creation state. Establish the minimum real-database and browser testing foundation through this working behavior.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Create and persist all three wallet types with a name, explicit THB currency, opening amount, and opening date. Display money with two decimals and tabular numerals.
- [ ] Parse opening amounts exactly into integer satang; accommodate amounts and aggregated balances beyond signed 32-bit integers. Zero/negative opening balances are supported by the accepted negative-balance model; do not apply the positive transaction-amount constraint to openings.
- [ ] Opening balances represent the start of their date, appear as balances rather than income, and persist across reloads. Do not introduce formal double-entry or event-sourced financial accounting.
- [ ] Show wallet name, type, and current opening-derived balance; provide an actionable empty state without fabricated personal money figures.
- [ ] Authenticate every server operation, derive ownership from the session, and reject reads/writes using another user's wallet identifiers. Client-supplied ownership cannot override the session.
- [ ] Add the minimum isolated real PostgreSQL operation-test harness and small browser harness; prove wallet creation/reload and signed-out/cross-user denial through observable behavior.
- [ ] Use the existing Next.js, React, TypeScript, PostgreSQL/Drizzle, Better Auth, Zod, Tailwind, and shared UI foundation. Preserve existing authentication behavior.
- [ ] Apply impeccable using the confirmed product context: phone/desktop layouts, labeled controls, legible THB figures, keyboard access, clear validation, and appropriate visual verification. Confirm the accent if needed and record the chosen design direction for subsequent UI tickets.
- [ ] Run relevant tests and existing formatting, lint, type, and build checks. Do not create separate schema-only or harness-only deliverables.

## Scope and handoff

Transaction capture follows in 02; opening corrections and archive/delete controls follow in 06. Reference the confirmed tracking specification and balance-model ADR for domain constraints. Covers the ownership, exact-money, empty-state, and wallet-opening parts of spec criteria 1, 2, 10, 24, and 25.
