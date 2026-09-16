# 09: Create the application package with category provisioning

**What to build:** Establish the application package through the first real use
case: creating a fresh user's complete default category set safely and repeatedly.

**Blocked by:** 08: Extract the PostgreSQL database boundary

**Status:** done

- [x] The application package exposes feature-specific source exports and owns application operation contracts.
- [x] Default-category initialization moves behind a framework-independent application operation.
- [x] One invocation creates the complete protected/default set in one database transaction.
- [x] Repeated and concurrent invocations neither duplicate defaults nor overwrite customization.
- [x] PostgreSQL integration tests prove success, rollback, idempotency, and ownership.

## Comments

- Created `packages/application` (`@bookkeeping/application`) with the
  feature subpath `/categories` (`initializeDefaultCategories`,
  `ProvisioningOutcome`) and `/categories/defaults` (`DEFAULT_CATEGORIES`,
  `DefaultCategory`). It depends on `@bookkeeping/database`,
  `@bookkeeping/domain`, and `drizzle-orm`; there is no repository interface.
- `initializeDefaultCategories(db, ownerId)` moved from the web app's
  `server/category.ts` verbatim in behavior: one transaction, a per-owner
  advisory transaction lock, and per-tree seeding only while the tree has no
  protected Uncategorized. It now returns `{ seededKinds }` so callers (the
  Better Auth hook and the explicit retry in tickets 10 and 12) can tell a
  first provisioning from a no-op.
- The default trees moved to the package with `iconId: string`, since the
  icon catalog is Lucide-bound presentation that stays in the web app.
  `GENERIC_ICON_ID` became domain vocabulary in
  `@bookkeeping/domain/categories`; the web catalog asserts it with
  `satisfies IconId`, and `icons.unit.test.ts` proves every default icon id
  is in the catalog.
- Web pages and integration tests import the package; the web copy and
  `features/categories/defaults.ts` were deleted, so there is one
  implementation. The web "category initialization" tests moved to
  `packages/application/src/categories/category.integration.test.ts`, which
  proves the complete set, whole-set rollback when one tree fails, repeated
  and concurrent idempotency, preserved customization, and owner isolation.
- Biome overrides, Sonar scope, `.gitignore`, and the README track the new
  package. Verified with Biome, root `types:check`, and the full `pnpm test`.
