# 07: Extract category and transaction vocabulary

**What to build:** Complete the persistence-required domain vocabulary so the
database package can depend on pure definitions rather than web-owned modules.

**Blocked by:** 06: Extract exact values and wallet vocabulary

**Status:** done

- [x] Category kinds, protected-category vocabulary, and client-neutral category types have one domain owner.
- [x] Transaction types, change actions, snapshots, filters, and client-neutral value contracts have one domain owner.
- [x] React components, icon components, labels, form schemas, and HTTP DTOs remain outside the domain package.
- [x] Persistence and web consumers use public feature subpaths or temporary forwarding exports.
- [x] Existing unit, integration, type, and build checks remain green.

## Comments

- Followed the ticket 06 pattern: vocabulary files moved verbatim into
  `packages/domain/src/categories/category.types.ts` and
  `packages/domain/src/transactions/transaction.types.ts`, exposed as the
  `@bookkeeping/domain/categories` and `@bookkeeping/domain/transactions`
  subpaths. No forwarding exports were left behind: the web categories
  vocabulary file was deleted, and the web transactions file was trimmed to
  the web-owned `LinkedExpenseView` view contract. Every consumer (Drizzle
  schema, server modules, hooks, components, schemas, tests) now imports the
  public subpaths directly for the moved symbols.
- Presentation labels stay web-owned in new app files
  `category-labels.ts` and `transaction-labels.ts` (mirroring
  `wallet-labels.ts`), so the domain package carries no display strings.
- `LinkedExpenseView` stayed in the web feature: it is a pre-formatted client
  view contract, not persistence vocabulary.
- Verified with Biome lint, root `types:check`, the domain package tests, the
  full web unit and PostgreSQL integration suites (106 tests), and the
  production build; all green.
