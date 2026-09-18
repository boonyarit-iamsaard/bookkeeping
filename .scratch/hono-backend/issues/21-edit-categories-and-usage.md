# 21: Edit categories and inspect their usage

**What to build:** Let an authenticated client update category presentation
details and obtain the usage information needed before category removal.

**Blocked by:** 19: Expose category trees as read-only resources

**Status:** done

- [x] Category update and usage operations move to the application package without duplicating validation.
- [x] Updates preserve tree position and enforce protected Uncategorized, name, icon, uniqueness, ownership, and missing-resource rules.
- [x] Usage reads report the existing transaction and child information required by management UX.
- [x] Successful updates return the direct updated category representation.
- [x] Application and HTTP tests cover normal, protected, duplicate, cross-owner, and unauthenticated behavior.

## Comments

- `updateCategory` now lives in `@bookkeeping/application/categories` beside the
  creation rules it mirrors: `validateCategoryUpdate` reuses the shared name
  normalization/bounds and the domain icon catalog, and the scoped name indexes
  remain the single uniqueness owner. The web adapter's Next.js-side copy and
  its local icon-catalog check were removed; `validateName` and
  `isScopedNameViolation` became module-private since the application now owns
  both. Updates only set name and icon, so tree position and kind cannot move.
- Usage reads live in the application package too: `findCategoryUsage` answers
  for one category with `transactions` (current, not deleted, income and
  expense transactions; refunds follow their expense and are never counted)
  and `children` (direct children, which keep a parent from being removed),
  read in one statement. `listCategoryUsage` keeps its transaction-count map
  for the management page, which derives child counts from the tree it holds.
- Hono exposes `PATCH /v1/categories/{categoryId}` (direct `200` category,
  field-addressed `422` for blank/long/duplicate names and unknown icons, and
  `protected` pointed at `#/name` since Uncategorized's icon may change) and
  `GET /v1/categories/{categoryId}/usage` (`200` with
  `{ transactions, children }`). Unknown, cross-owner, and malformed
  identifiers stay non-disclosing `404`s on both.
- Application PostgreSQL coverage now includes update and usage behavior
  beside the creation rules; shared wallet and transaction fixtures open a
  wallet through the operation and insert categorized rows directly. HTTP coverage adds both routes end to end, including
  malformed JSON, anonymous requests, unknown fields, and no-op updates.
  OpenAPI documentation tests cover the new schemas (`UpdateCategoryRequest`,
  `CategoryUsage`) and the "documents every registered route" check passes.
- Full `pnpm test` passed in this environment (Docker available): all six
  workspace test tasks green, plus Biome and every workspace typecheck.
- Review follow-up on `main`: the JSON command middleware and its validated
  input type moved to `core/http/request-validation.ts` beside the resource
  param middleware, so wallet and category routes share one copy; the wallet
  fixture moved to `testing/wallet-fixture.ts` as `createWalletForTest`; and
  `listCategoryUsage` returned to its numeric map since its only consumer
  ignored the added child counts.
