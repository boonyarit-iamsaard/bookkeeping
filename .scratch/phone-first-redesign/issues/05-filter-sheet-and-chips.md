# 05: Transactions filter sheet and chips

Read `../spec.md` first (Sheet, Transactions, Rule amendments).

**What to build:** Transactions leads with the list. Filter in the title bar
opens a sheet with the current filter fields, and active filters show as
removable chips under the title. This ticket also brings the shared sheet to
its new form, since filters are its first user.

**Blocked by:** 01 (Shell: tab bar, desktop header, title bar and standalone chrome)

**Status:** ready-for-agent

**Out of scope:** the avatar sheet and moving the category editor onto the
restyled sheet (07); any change to what the filters do or which values are
valid.

- [ ] The shared sheet is Paper with a 14px top radius, a 4×36px Hairline grab handle, a scrim of Ink at 40% and no shadow; it has bottom safe-area padding, is capped at 85% of the viewport height with its content scrolling inside, and slides up in 200ms ease-out while the scrim fades.
- [ ] From 640px the sheet is a centred, content-height dialog.
- [ ] The sheet traps focus, closes on Escape and returns focus to its trigger; its slide and fade are removed under `prefers-reduced-motion`.
- [ ] Filter in the Transactions title bar (beside the h1 on desktop) opens the sheet with today's fields (inclusive From and To dates, wallet, category, type) and neutral Apply and Clear.
- [ ] Active filters show as removable chips under the title; removing a chip drops just that filter from the address.
- [ ] The inline filter disclosure is gone.
- [ ] Filters stay GET values in the URL; invalid values stay editable in the sheet with their message.
- [ ] Transactions no longer has its own Record button or the "Monthly summary & balances" link.
- [ ] The history browser spec covers opening the sheet, applying filters, chips, removing one chip, Clear, and an invalid value kept editable.

**Verify:** `pnpm run ci`, then the touched specs alone on `phone-chromium`.

## Comments
