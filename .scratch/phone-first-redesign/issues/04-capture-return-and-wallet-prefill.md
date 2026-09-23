# 04: ＋ capture: return to where you started and wallet pre-fill

Read `../spec.md` first (Capture).

**What to build:** Capture no longer pulls the account holder away. ＋ (and
the desktop New transaction button) remembers the screen it was opened from;
Save returns there with the new row fading in, and Cancel returns there too.
Opened from an active wallet's page, the form starts on that wallet.

**Blocked by:** 02 (Home), 03 (Wallet page and the `/manage` split)

**Status:** done

**Out of scope:** the entry form's fields, validation, idempotency and Save
bar (governed by `.scratch/tracking/design-brief-transaction-form.md`); save
and cancel on edit and refund, which stay as they are.

- [x] New transaction accepts an optional origin (an in-app screen with its search) and an optional wallet to pre-fill; ＋ and the desktop button pass the current screen as the origin, and pass the wallet only on a wallet page.
- [x] Origin resolution is a pure function: an internal path of this app is accepted; anything else, or none, resolves to Home. Unit-tested.
- [x] Default-wallet choice is a pure function: the passed wallet if it is active, else the last-used wallet, else the first active wallet. Unit-tested.
- [x] After a successful create the app goes to the origin with `created=<id>`, and the row arrives with the 500ms fade wherever it is listed (Home's recent list, Transactions with its filters kept, a wallet page).
- [x] Cancel (title bar on phone, beside the h1 on desktop) goes to the origin without `created`.
- [x] From an archived wallet's page, the form silently starts on the last-used wallet.
- [x] From filtered history, the form never pre-fills from the filters.
- [x] The transaction-entry browser spec covers: ＋ from Home, from Transactions and from a wallet page each returning there with the new row; pre-fill from an active wallet page; fallback from an archived one; no pre-fill from filtered history; Cancel returning to the origin.

**Verify:** `pnpm run ci`, then the touched specs alone on `phone-chromium`.

## Comments

- Implemented capture-origin preservation, return highlighting, and active-wallet prefill; updated the transaction-entry spec.
- Verified `pnpm run ci` and the focused `phone-chromium` transaction-entry browser spec (6 passed).
