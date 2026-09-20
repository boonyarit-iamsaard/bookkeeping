# Owned invariants instead of tactical or strategic DDD

The 2026-09-20 backend architecture review found business rules enforced in
up to four places (application, HTTP schema, web form schema, PostgreSQL
checks) but no term with two meanings and no consistency need that locking
inside one application operation cannot satisfy. We therefore adopt only the
lightest domain-driven practice: the single context and root `CONTEXT.md`
stay, and every business rule has exactly one author module in
`@bookkeeping/application`, evaluated as a pure acceptance step over facts the
operation has already loaded and locked. Adapters validate shape and may mirror
a rule as a client hint, but they never assert it. We do not introduce
aggregate classes, repositories, domain events, or bounded contexts.

## Considered options

- Aggregates for expense-with-refunds, wallet-with-transactions, and the
  category tree: rejected because the expense, wallet, and tree locks already
  act as consistency roots inside one operation, and a class would add an
  interface without adding locality.
- Placing pure rules in `@bookkeeping/domain`: rejected because it buys a
  label, not locality, and would reopen ADR-0004's ownership line.
- Separate contexts for reporting or provisioning: rejected because they read
  the same records with the same meanings.

## Consequences

- Revisit when a term acquires a second meaning (for example a planned versus
  recorded expense in budgeting) or when an invariant spans operations that
  cannot share one lock.
- Architecture reviews should not re-propose aggregates or bounded contexts
  without new evidence of that kind.
