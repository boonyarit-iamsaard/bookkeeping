# 17: The delete-transaction confirmation uses its own sheet

Read `../spec.md` first.

**What to build:** The delete-transaction confirmation is built on the shared sheet primitive, like every other sheet.

**Blocked by:** None (can start immediately)

**Status:** needs-triage

**Out of scope:** the confirmation's copy and behaviour.

- [ ] `apps/web/src/features/transactions/components/delete-transaction-button.tsx` renders through `SheetPortal` (40% Ink scrim, 200ms ease-out, grab handle, no border), not its own 30% scrim, 300ms curve and `sm:border` (around lines 182–184).
- [ ] The transactions spec's delete test still passes on `phone-chromium`.

## Comments

From 07's milestone critique (2026-09-24): P3, material (breaches the spec's Sheet: "one shared primitive"). Found from source; the confirmation was not opened during the critique because it sits one tap from a destructive action.
