# 07: Port transaction entry

Read `../worker-brief.md` first.

**What to build:** `/transactions/new` for income and expense: the type
segmented control, wallet select with last-used wallet as default, category
picker (from ticket 06) with inline create, date picker defaulting to
Bangkok today, money input, description, and the fixed Save bar on phone.
Transfers, refunds, and corrections are later tickets; the form is ported
whole but only the income and expense paths are wired and tested here.

**Blocked by:** 06: Port categories

**Status:** done

**Pattern to copy:**

- Legacy `features/transactions`: the transaction form, its schema and hook
  (with unit tests), `SignedMoney`, `use-bangkok-today`, labels and types.
  Copy the whole form component so tickets 09 and 10 do not re-port it;
  leave transfer and refund branches present but unexercised.
- Entry defaults come from the entry-defaults read; wallets and categories
  from their query options.
- Success navigates to `/transactions?created=<id>`. The history route can
  be a placeholder that only reads the query string until ticket 08.

**Out of scope:** history list and detail (08); transfers and refunds (09);
edit and delete (10); saving offline; any change to the amount grammar or
validation messages.

- [x] A new expense and a new income can be saved with the default wallet, a chosen category, today's date, and an amount; the wallet balance on `/wallets` reflects it.
- [x] Validation errors (empty amount, future date, no wallet) are shown exactly as before, values preserved; a server rejection shows the error bar.
- [x] With no active wallet the screen offers creation or wallet management, as the legacy screen does.
- [x] Creating a category inline from the picker works and selects it.
- [x] Copied schema and helper unit tests pass.
- [x] Browser spec `transaction-entry.spec.ts` covers the above and passes on `phone-chromium`. The legacy `transactions.spec.ts` stays until ticket 10.
- [x] `pnpm run ci` is green.

**Verify:** `pnpm run ci`; `pnpm --filter @bookkeeping/web test:e2e -- --project=phone-chromium transaction-entry`.

## Comments

Ported the complete income/expense transaction form to the SPA, including the
copied transfer/refund branches for later tickets. It uses entry defaults and
query-backed wallet/category options, exact API money values, the shared
idempotent write helper, inline category creation, and the fixed mobile Save
bar. Added the `/transactions?created=<id>` placeholder and five phone
Chromium browser scenarios. The legacy `transactions.spec.ts` remains as
required.

Verification: `pnpm run ci` passed with host access for the repository's
container-backed integration tests; the focused transaction-entry suite passed
5 tests on `phone-chromium`.
