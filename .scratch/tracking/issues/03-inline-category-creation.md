# 03: Create categories within transaction entry

**What to build:** Search and choose categories or create a missing parent/child while staying on transaction create/edit. Newly saved categories are immediately selected and use recommended or manually chosen icons.

**Blocked by:** 02: Record income and expenses reliably.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Search both levels of the active income/expense tree and show parent › child results grouped under parents; either level is selectable.
- [ ] An unmatched query offers category creation with that name prefilled, without navigating away from the transaction screen.
- [ ] Create a parent or a child under an existing parent; create a missing parent within child creation. Restrict trees to two levels and require owner/tree-consistent relationships.
- [ ] Reject blank names and scoped duplicates after surrounding-whitespace trimming and case-insensitive comparison. Parent scope is user/tree; child scope is parent. Enforce this under concurrent creation too.
- [ ] Do not permit children beneath Uncategorized. Category creation cannot change its protected name or remove it.
- [ ] Save categories independently, select the newly created category immediately, and preserve transaction form values. Canceling the transaction retains saved categories; no persistent transaction draft is required.
- [ ] Ship a catalog with unique permanent IDs, Lucide glyph mappings, browsing groups, and English semantic tags. Persist the chosen ID only; catalog groups do not become financial categories. Confirm exact catalog contents during this ticket.
- [ ] Recommend up to six icons locally using consistently normalized English names/tags, stronger whole-name/token matches before weaker matches, and deterministic ties. Check compound names such as car insurance and short-token false positives.
- [ ] Require an icon with a guaranteed generic preselection; allow browsing by group and manual overrides. Empty/unmatched queries or recommendation failure never block saving. Unknown stored IDs render generically without silently rewriting the ID.
- [ ] Use the confirmed panel/dialog behavior, appropriate phone/desktop transitions, labels, field errors, focus handling, and reduced motion. Nested keyboard actions cannot accidentally submit/cancel the outer transaction. Apply impeccable and visually verify the flow.
- [ ] Cover ownership, scoped uniqueness, two-level protection, durable independent category saves, and selected icon persistence through PostgreSQL operations; browser-test missing-parent/child creation and canceled-transaction persistence.
- [ ] Make the category interaction reusable by the later edit surface without adding a dependency on 04. Run relevant tests and existing repository checks.

## Scope and handoff

Rename/icon updates and category removal management follow in 08; do not add child reparenting. Covers spec criteria 1, 15–17, 19, 24–25 and the confirmed icon implementation notes.
