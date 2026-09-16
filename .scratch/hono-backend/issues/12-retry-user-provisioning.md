# 12: Retry interrupted fresh-user provisioning

**What to build:** Ensure a user whose auth record committed before default
category initialization failed can safely complete provisioning after signup or
sign-in.

**Blocked by:** 11: Mount Better Auth and authenticated context in Hono

**Status:** done

- [x] The Better Auth post-create hook invokes the idempotent application initializer after user creation.
- [x] An authenticated explicit operation retries provisioning without serving as a legacy backfill.
- [x] Category reads no longer initialize or mutate default categories.
- [x] A post-commit hook failure leaves a reproducible incomplete state that the retry resolves.
- [x] Tests cover normal provisioning, hook failure, repeated retry, concurrent retry, and cross-user isolation.

## Comments

- `createAuth` now registers Better Auth's `databaseHooks.user.create.after`,
  which calls `initializeDefaultCategories(db, user.id)`; `@bookkeeping/auth`
  depends on `@bookkeeping/application` as ADR 0004 describes. The hook runs
  after the sign-up transaction commits (Better Auth queues after-hooks and
  runs them once `adapter.transaction` returns), so a failure there can no
  longer roll the user back. The hook therefore logs
  `Fresh-user provisioning failed` and lets the sign-up succeed with its
  session: the user is real and recoverable, and rethrowing would have
  turned an already-created user into a failed request whose retry hits
  "user already exists".
- The explicit retry is `POST /v1/categories/defaults`
  (`apps/server/src/features/categories/category.routes.ts`, operation
  `initializeDefaultCategories`). It needs no body or `Idempotency-Key`: the
  initializer is naturally idempotent, so it returns `200` with
  `ProvisioningOutcome` (`{ seededKinds }`, empty when already complete)
  rather than `201` + `Location`. It seeds only trees lacking a protected
  Uncategorized, so it is recovery, not a backfill, and never touches a
  customized tree. `createApp` now takes `db`; `createTestApp` accepts
  `{ auth?, db? }` and defaults to a pool that never connects, so unit tests
  need no database. The real-mount factory both server integration suites
  use (`createMountedTestApp`, `signUpThroughMount`, shared test origins) now
  lives in `apps/server/src/testing/create-mounted-test-app.ts` per the
  `src/testing/` convention.
- Category reads no longer provision: the three Next.js pages
  (`/categories`, `/transactions/new`, `/transactions/[id]/edit`) dropped
  their `initializeDefaultCategories` calls. The Next.js adapter's explicit
  retry is `retryProvisioningAction`
  (`apps/web/src/features/auth/server/provisioning.actions.ts`); both form
  hooks await `completeProvisioning()`
  (`features/auth/complete-provisioning.ts`) before the dashboard redirect,
  and a failure there does not block the redirect.
- Tests. `packages/auth/src/config.integration.test.ts`: sign-up through
  `auth.api` provisions both trees; a post-commit failure is reproduced by
  renaming the `categories` table inside the rolled-back test transaction
  (transactional DDL), so the real hook path fails: sign-up still issues a
  session, the failure is logged with the user id, no categories exist, and
  `initializeDefaultCategories` then seeds both trees. Verified the test
  fails when the hook rethrows.
  `apps/server/src/features/categories/category.routes.integration.test.ts`
  runs the real mount: an incomplete owner is completed and a second call
  reports `[]`; anonymous requests get the `unauthenticated` problem; four
  concurrent retries seed each tree exactly once (committed connection);
  and one owner's retry never seeds or alters another owner. The OpenAPI
  "every registered route is documented" test covers the new operation
  (200, 401, 500).
- `pnpm run ci` passed (Biome, Prettier, markdownlint, type checks, all
  package and app suites). `wallets.spec.ts` and `categories.spec.ts` on the
  desktop project passed as the browser oracle for the changed sign-up flow
  and the categories page now relying on the hook.
- `/code-review` (standards + spec) found no missing requirements; its
  actionable notes — the duplicated mount factory, the duplicated retry
  block in the form hooks, a name-based protected-row query in the auth
  test, the `provisioningOutcomeResponseSchema` name, and recording why the
  retry answers `200` rather than `201` (README) — were applied. Deliberate
  deviations kept: the hook logs without a request id (the auth package is
  framework-independent), and the Next.js retry adds one DB round-trip per
  sign-in.
