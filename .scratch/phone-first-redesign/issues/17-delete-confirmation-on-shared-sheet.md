# 17: The delete-transaction confirmation uses its own sheet

Read `../spec.md` first.

**What to build:** The delete-transaction confirmation is built on the shared sheet primitive, like every other sheet.

**Blocked by:** None (can start immediately)

**Status:** done

**Out of scope:** the confirmation's copy and behaviour.

- [x] `apps/web/src/features/transactions/components/delete-transaction-button.tsx` renders through `SheetPortal` (40% Ink scrim, 200ms ease-out, grab handle, no border), not its own 30% scrim, 300ms curve and `sm:border` (around lines 182–184).
- [x] The transactions spec's delete test still passes on `phone-chromium`.

## Comments

From 07's milestone critique (2026-09-24): P3, material (breaches the spec's Sheet: "one shared primitive"). Found from source; the confirmation was not opened during the critique because it sits one tap from a destructive action.

Triaged (2026-09-24): in scope with the rest of 12–18, after 13.

Closed (2026-09-24):

- Built in 4770068. The confirmation keeps `AlertDialog.Root`, whose parts
  are Base UI's Dialog parts, and renders through `SheetPortal`, so it gets
  the 40% Ink scrim, 200ms ease-out slide, grab handle and no border. Copy and
  behaviour are unchanged. The text scrolls inside the 85% cap while Delete
  and Keep it stay pinned below it, and padding follows the other sheets
  (`px-4`, `sm:px-6`). On desktop it now fades in like the other sheets
  instead of scaling and nudging up.
- `pnpm run ci` passes, and both delete tests in `transactions.spec.ts` pass
  on `phone-chromium`.
