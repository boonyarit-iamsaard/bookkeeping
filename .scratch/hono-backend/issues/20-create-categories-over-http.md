# 20: Create categories idempotently over HTTP

**What to build:** Let an authenticated client create parent or child categories
safely across retries while preserving tree and uniqueness rules.

**Blocked by:** 13: Introduce reusable creation idempotency; 19: Expose category trees as read-only resources

**Status:** done

- [x] Category creation moves to the application package with one owner for normalization and validation.
- [x] Parent and child creation enforce kind, parent ownership, depth, name, icon, protected-category, and scoped uniqueness rules.
- [x] Creation requires an idempotency key and supports replay, changed-payload conflict, and concurrent requests.
- [x] Success returns `201`, the direct category representation, and its location.
- [x] PostgreSQL and HTTP contract tests cover authenticated, invalid, duplicate, cross-owner, and idempotent outcomes.

## Comments

- Category creation now lives in `@bookkeeping/application/categories` as the
  shared `createCategory` operation. It trims and validates names and shared
  icon ids before `executeIdempotentCreation`, then enforces same-tree parent
  ownership/kind, two-level depth, protected-category rules, and database-backed
  scoped uniqueness. Parent-plus-child creation remains atomic, including its
  replayable result snapshot.
- Hono exposes `POST /v1/categories` with a required `Idempotency-Key`, strict
  request validation, direct `201` category responses, `Location`, stable
  `409` replay conflicts, and field-addressed `422` Problem Details. The Next.js
  adapter now calls the same application operation and mints a submission key.
- Added application PostgreSQL coverage for creation, normalization, validation,
  replay, conflict, and concurrent retries; HTTP coverage for authentication,
  direct representations, parent-plus-child creation, validation, duplicate,
  protected and cross-owner parents, key requirements, replay, conflict,
  concurrency, malformed JSON, and OpenAPI/runtime schemas. Focused unit tests,
  all unit projects, typechecks, and Biome checks pass.
- The full repository test command was attempted. The local checkout cannot
  discover a pnpm binary for Turbo, and direct integration execution cannot
  start PostgreSQL because Docker/Testcontainers is unavailable; the existing
  integration suites therefore remain unrun in this environment.
- Review follow-up: `Location` on `201` named a resource no route served, so
  `GET /v1/categories/{categoryId}` now exists as the same non-disclosing
  read the wallet detail uses, backed by `findCategory` in the application
  package. The operation rule tests moved from the Next.js adapter into
  `@bookkeeping/application/categories` beside their owner.
