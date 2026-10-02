# 01: Spending by category: parent breakdown

Read `../spec.md` first. It is the spec; do not reopen its decisions. Also
read `CONTEXT.md` (**Category spending**), ADR 0011, ADR 0012, and the
category breakdown bar under "Level 3" in `DESIGN.md`'s Charts section.

**What to build:** Reports shows, for the chosen month, where the money went.
A Spending by category section sits under the month card: the category
breakdown bar made of each expense parent's segment in category order with
Uncategorized last (hatched neutral, only when it has spending), and a legend
row per parent with its swatch, name, exact amount and share stated as text.
The figures come from a new server read, `GET /v1/reports/category-spending?month=YYYY-MM`,
returning the month's Net expenses and one row per parent with activity
(id, name, sort order, Uncategorized flag, signed category spending). Debt
payments count; refunds reduce the month they are dated in, under their
expense's current category. A month with no expenses or refunds says "No
spending in" that month; loading shows a skeleton. This ticket assumes every
parent is positive; negative categories and children arrive in 02.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The read reuses the monthly report's month query schema, is owner-scoped from the session, and has its own named OpenAPI schema; the generated web client is regenerated
- [x] Money is in the existing money schema, exact minor units, never summed on the client
- [x] Route integration tests: the parent amounts sum to the monthly report's Net expenses for the same month, including a Debt payments expense; a refund in the same month reduces its expense's parent; Uncategorized appears flagged only with activity; parents without activity are absent; month validation and authentication problems match the monthly report
- [x] A pure derivation turns the response into ordered segments (sort order, Uncategorized last) with shares; unit tested like the existing trend series
- [x] The section uses the DESIGN.md breakdown bar and legend exactly, works at 360px, and carries every figure as text
- [x] Empty month and loading states as described
- [x] One focused browser case in the existing Reports spec on one project shows the section for a month with data and the empty state for an empty month
- [x] `pnpm run ci` passes

Closed by 346f162: `GET /v1/reports/category-spending`, the breakdown derivation, and the Spending by category section. Shares divide by the server's Net expenses, which ticket 02 changes to positive spending.
