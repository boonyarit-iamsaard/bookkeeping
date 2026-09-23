# API parity inventory

> Closed 2026-09-21. This is a historical record: it proved the Hono API
> covered the former Next.js adapter before the SPA client replaced it
> ([ADR 0006](adr/0006-vite-tanstack-router-spa-client.md)). The flow names
> below refer to that removed app. The API's current contract is its
> generated OpenAPI document.

Every user-visible backend behavior the former Next.js adapter offered, and the
Hono operation that covers it. This is the closing audit for the Hono backend
and shared-package extraction: a flow is either mapped to a tested HTTP
operation or recorded below as an explicit difference with its reason.

Parity here is behavioral. It covers what a person can do through the product,
not every exported internal helper. Both backends call the same
`@bookkeeping/application` operations, so the question this table answers is
whether the HTTP surface reaches all of them, not whether the rules agree.

Read [ADR 0003](adr/0003-hono-application-backend.md) for the migration
decision and `.scratch/hono-backend/spec.md` for the contract decisions the
operations follow.

## Authentication and provisioning

| Next.js flow                                   | Hono operation                 | Proven by                                                                 |
| ---------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------- |
| Sign up (`useSignUpForm`)                      | `POST /api/auth/sign-up/email` | `apps/server/src/core/auth/gateway.integration.test.ts`                   |
| Sign in (`useSignInForm`)                      | `POST /api/auth/sign-in/email` | Better Auth owned; gateway tests prove the mount and CSRF rejection only  |
| Sign out (`AccountMenu`)                       | `POST /api/auth/sign-out`      | Better Auth owned; gateway tests prove the mount only                     |
| Session behind every page                      | `GET /api/auth/get-session`    | `apps/server/src/core/auth/session.unit.test.ts`, gateway tests           |
| Provisioning retry (`retryProvisioningAction`) | `initializeDefaultCategories`  | `apps/server/src/features/categories/category.routes.integration.test.ts` |

Better Auth routes stay outside `/v1`; every `/v1` route requires the API
session cookie. Owner identity is always derived from the session, never from
a request body.

## Wallets

| Next.js flow                               | Hono operation             | Proven by                           |
| ------------------------------------------ | -------------------------- | ----------------------------------- |
| `/wallets` list                            | `listWallets`              | `wallet.routes.integration.test.ts` |
| Dashboard balances on a chosen date        | `listWallets?asOf=`        | `wallet.routes.integration.test.ts` |
| `/wallets/[id]` detail                     | `getWallet`                | `wallet.routes.integration.test.ts` |
| `createWalletAction`                       | `createWallet`             | `wallet.routes.integration.test.ts` |
| `manageWalletAction` — opening correction  | `replaceWalletOpening`     | `wallet.routes.integration.test.ts` |
| `manageWalletAction` — archive and restore | `changeWalletArchiveState` | `wallet.routes.integration.test.ts` |
| `manageWalletAction` — delete              | `deleteWallet`             | `wallet.routes.integration.test.ts` |

## Categories

| Next.js flow                                   | Hono operation      | Proven by                             |
| ---------------------------------------------- | ------------------- | ------------------------------------- |
| `/categories` tree, transaction-form pickers   | `listCategories`    | `category.routes.integration.test.ts` |
| `/categories` entry counts per category        | `listCategoryUsage` | `category.routes.integration.test.ts` |
| Removal pre-check for one category             | `getCategoryUsage`  | `category.routes.integration.test.ts` |
| Single category read                           | `getCategory`       | `category.routes.integration.test.ts` |
| `createCategoryAction`                         | `createCategory`    | `category.routes.integration.test.ts` |
| `manageCategoryAction` — rename or change icon | `updateCategory`    | `category.routes.integration.test.ts` |
| `manageCategoryAction` — remove with fallback  | `deleteCategory`    | `category.routes.integration.test.ts` |

## Transactions

| Next.js flow                                                          | Hono operation                | Proven by                                |
| --------------------------------------------------------------------- | ----------------------------- | ---------------------------------------- |
| `/transactions` history with date, wallet, category, and type filters | `listTransactions`            | `transaction.routes.integration.test.ts` |
| `/transactions/[id]` detail                                           | `getTransaction`              | `transaction.routes.integration.test.ts` |
| Refund panel on an expense                                            | `getTransactionRefunds`       | `transaction.routes.integration.test.ts` |
| `/transactions/new` last-used wallet                                  | `getTransactionEntryDefaults` | `transaction.routes.integration.test.ts` |
| `createTransactionAction` — income and expense                        | `createTransaction`           | `transaction.routes.integration.test.ts` |
| `createTransactionAction` — transfer                                  | `createTransaction`           | `transaction.routes.integration.test.ts` |
| `createTransactionAction` — linked refund                             | `createTransaction`           | `transaction.routes.integration.test.ts` |
| `updateTransactionAction`                                             | `updateTransaction`           | `transaction.routes.integration.test.ts` |
| `deleteTransactionAction`                                             | `deleteTransaction`           | `transaction.routes.integration.test.ts` |

## Reports and operations

| Next.js flow              | Hono operation      | Proven by                           |
| ------------------------- | ------------------- | ----------------------------------- |
| Dashboard monthly summary | `getMonthlyReport`  | `report.routes.integration.test.ts` |
| —                         | `getHealth`         | `health.routes.unit.test.ts`        |
| —                         | `GET /openapi.json` | `core/http/openapi.unit.test.ts`    |

`getHealth` and the OpenAPI document have no Next.js counterpart; they serve
the deployment boundary itself.

## Contract coverage

`apps/server/src/core/http/api-contract.integration.test.ts` drives every
published operation over HTTP and checks each response against the schema the
generated document names for it, then fails if the set of exercised operations
differs from the set the document publishes. It also answers every Problem
Details code the API produces and checks each against its documented variant.
`core/http/openapi.unit.test.ts` fails when a registered route is undocumented,
and `core/http/problem-details.unit.test.ts` covers every declared problem
code, including the four the transport maps but no current operation answers.

## Explicit differences

These are decided, not overlooked.

- **Category removal reports no reassignment summary.** `deleteCategory`
  answers `204` with no body ([ticket 22](../.scratch/hono-backend/issues/22-remove-categories-over-http.md)).
  The Next.js page built its "N entries moved to X" message from the
  application result it held; the SPA builds the same message from the usage
  it read before removing. A removal-outcome representation needs a real
  client asking for one.
- **Transaction change history stays private.** `listTransactionChanges` backs
  atomicity and concurrency tests, not a user-facing feature, so the spec keeps
  it off the API.
- **Presentation stays with the app that renders it.** Labels, the icon
  catalog and its search, form schemas, and money formatting are client
  concerns; the API publishes exact semantic values and lets each client
  render them.
- **Next.js cache invalidation had no API surface.** `revalidatePath` was how
  the adapter refreshed its own rendered pages; the SPA refreshes its cached
  reads after each write on its own.
- **The API paginated where Next.js did not.** `listTransactions` returns
  opaque cursors from its first version; the Next.js history page read an
  unpaginated list. The SPA history pages through those cursors.
- **Wallet and category collections stay unpaginated.** Both are small and
  bounded by one owner's own records.

## What this does not close

The Next.js adapter has been removed. The SPA client is now the sole web client
and calls Hono directly; its Better Auth client uses the Hono mount. The former
Next.js Better Auth mount and frozen browser suite were deleted with the
adapter. The explicit differences above are deliberate API-shape choices, not
remaining migration work.
