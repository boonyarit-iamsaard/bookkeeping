# Derive wallet balances from transactions

For the tracking milestone, derive wallet balances from dated opening balances and current transactions rather than introducing formal double-entry accounting or an event-sourced financial write model. Direct edits replace financial effects and deletion removes them; atomic transfers and an internal change history provide consistency and traceability without additional accounting concepts. Creation idempotency prevents repeated submissions from duplicating financial effects independently of this balance model.
