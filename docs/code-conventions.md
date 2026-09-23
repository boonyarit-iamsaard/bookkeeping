# Code conventions

## Structure and ownership

Use feature-first organization following the
[Bulletproof React reference](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md),
with TanStack Router conventions and the TypeScript house style. The goal is
consistency with recognizable conventions, rather than a new architecture
framework. See [the supporting research](research/codebase-structure-and-naming.md).

Keep the `core`, `shared`, and `features` roots. Feature code stays with its
feature, infrastructure setup stays in `core`, and reusable code stays in
`shared`. Create additional directories only when needed. `features` may
import `core` and `shared`; `shared` may import `core/api` types and parsers,
such as the shared `Money` component rendering API amounts, but never
`features`.

Vocabulary and exact value behavior that persistence and both apps need live in
`@bookkeeping/domain` under feature directories such as `packages/domain/src/wallets/`,
exposed as subpaths such as `@bookkeeping/domain/wallets`. The package has no
React, Hono, Drizzle, environment, or presentation code; labels and
form schemas stay with the app that renders them.

Pure feature vocabulary has one owner in a descriptive feature-local file such
as `wallet.types.ts`. Shared shapes, literal value sets, and their presentation
labels can live together there. Database code and browser code import those
declarations directly; persistence files and forwarding exports do not own the
vocabulary. Keep operation-specific inputs and errors beside their functions.

## Filenames and symbols

Separate descriptive words with hyphens and recognizable qualifiers with dots.
Dots are compatible with kebab-case; qualifiers are optional, not a taxonomy
that every module must fit. For example:

| Purpose                  | Filename                       | Symbols                                     |
| ------------------------ | ------------------------------ | ------------------------------------------- |
| Wallet behavior          | `server/wallet.ts`             | `createWallet`, `listWallets`               |
| API write helper         | `core/api/write-submission.ts` | `createWriteSubmission`                     |
| Shared wallet vocabulary | `wallet.types.ts`              | `WalletType`, `WalletSummary`               |
| Wallet labels            | `wallet-labels.ts`             | `WALLET_TYPE_LABELS`                        |
| Create form              | `create-wallet-form.tsx`       | `CreateWalletForm`, `CreateWalletFormProps` |
| Form hook                | `use-create-wallet-form.ts`    | `useCreateWalletForm`                       |

Apply the same convention to categories and transactions. A file with several
related functions uses their common concept; one concept per file does not mean
one function per file. Preserve framework-required filenames and exports.

Name infrastructure behavior by what callers observe rather than by its
current vendor or wiring mechanism. Use `create` for functions that construct
and return a value, `parse` for validated external input, `register` for
functions that mutate an existing application, and `describe` for OpenAPI
documentation. A ready router is `<feature>Routes`; a router factory is
`create<Feature>Routes`. A ready middleware is `<purpose>Middleware`; a
middleware factory is `create<Purpose>Middleware`. Normalized runtime settings
are `Config`, while `Env` is reserved for framework environment contracts or
raw environment input. Test composition factories name their scope, such as
`createUnitTestApp` and `createIntegrationTestApp`; scenario helpers name the
observable behavior, not the underlying mount.

Name seams by the capability they provide, not their adapter implementation.
For example, `AuthGateway` remains accurate if the authentication library
changes, while an implementation-named gateway would become stale.

Use test scope in filenames: `*.unit.test.ts`, `*.integration.test.ts`, and
`tests/e2e/*.spec.ts`. Match each colocated test's stem to its source module.
Integration tests may exercise real PostgreSQL and are distinct from
browser-driven E2E tests. Database fixture names describe infrastructure.

Helpers shared by a workspace's Vitest tests live in its `src/testing/`
directory, following the Bulletproof React reference; neither Hono nor Vitest
prescribes a location. The database package exposes its fixtures as
`@bookkeeping/database/testing`, and the server keeps its unit and integration
app factories in `apps/server/src/testing/`. Playwright helpers stay beside the
specs in `apps/web/tests/e2e/helpers/`. Test helpers are excluded from
production builds.

## Rule ownership

Every business rule has exactly one author module in `@bookkeeping/application`,
evaluated as a pure acceptance step over facts the operation has already loaded
and locked, such as `acceptTransaction` in
`packages/application/src/transactions/transaction-rules.ts`. A rejection names
the input field it addresses, so adapters map fields with a table rather than
re-deciding them. Adapters validate shape at their own interface: request and
form schemas check types, formats, and required fields. A client may mirror a
rule as a hint, but the hint never diverges from the rule and nothing outside
the author asserts it. See ADR 0005.

## Cached reads

The SPA's read queries stay together in `apps/web/src/core/api/queries.ts`,
keyed by OpenAPI path and parameters. After a successful write, callers call
`refreshAfterWrite` from `core/query/refresh-after-write.ts`, which refreshes
every read except the session instead of tracing which reads the write
reached; reads embed each other's records, so a precise map would drift. A
delete passes its record's own reads as `retired`, navigates away, and then
calls `forgetReads`. A session change (sign in, sign up, sign out, or a 401)
clears every cached read through `resetSessionCache`; provisioning a new
user's default categories needs no refresh because it runs before that
clearing. Nothing else invalidates, removes, or overwrites cached reads. A
screen may show the previous data briefly on its next visit while it re-reads;
that is accepted.

## Test ownership

The application package owns business-rule coverage. Other layers may rely on
a rule inside a fixture, but they never assert it, so a changed rule turns red
in one layer and the failure names its owner.

The server route suite asserts six things: status code and problem-details
mapping; request validation to field-error mapping for each body-accepting
endpoint; authentication, session, and ownership enforcement at the boundary;
response serialization against the exported Zod response schemas; idempotency
key HTTP semantics; and one happy-path round trip per endpoint. Keep one
representative test per problem code per endpoint. Domain rules exercised
through HTTP are out of scope: a route test may trigger a rule to obtain an
error class, but it asserts the mapping, not the rule.

Route integration tests provision owners through the test authentication
gateway. Real Better Auth over HTTP is covered by the gateway integration test
and the API contract test.

The SPA browser suite owns client and browser-boundary coverage; server
integration tests own HTTP and persistence behavior. The SPA has no component
tests, so a browser test that asserts UI behavior, such as kept form values,
focus, dialogs, or guards, stays even when the server covers the rule behind
it. A browser test is redundant, and is removed, when its assertions are all
HTTP-level ones that a route integration test already makes, or when another
browser test asserts a superset of it through the same code path.

Browser specs run on the narrowest phone project. Tag a test `@matrix` only
when its behavior differs by engine or viewport, such as layout, navigation
guards, or the service worker; the other two projects run only those tests.

Budget: `pnpm test`, as Turborepo runs it with packages in parallel, completes
in three minutes or less on the development machine. Check it by hand; it is
not gated in CI, which keeps CI free of hardware-dependent flakes.

## TypeScript house style

Biome enforces the supported mechanical rules, including filename and identifier
case, object-contract `interface` declarations, assertion restrictions, named
project imports and exports, runtime app `index.ts` barrel restrictions, named React
function declarations, parameter-count limits, braced guards, and `node:` imports.
Tests obey the same safety rules. External property keys and domain value keys
retain their established spelling, including environment variables, snake-case
wallet types, and library names such as `baseURL`.

Review the rules that require semantic judgment:

- Use named object contracts and `interface extends` for compatible composition;
  use `type` for unions, mapped types, tuples, and primitive aliases. Review app
  type-only barrel hubs too; Biome's barrel rule checks runtime re-exports.
- Keep derived types shallow and consumer-facing shapes legible.
- Declare named behavior with `function`; arrows are inline callbacks or capture
  `this`. Generic parameters must connect at least two positions.
- Use an options object at three parameters or whenever a parameter is boolean.
  Mark nonmutated object and array parameters readonly.
- Name props `[ComponentName]Props` and accept `Readonly<ComponentNameProps>`.
  Generated props helpers can be wrapped in `Readonly` directly.
- Infer initialized values and private helpers. Exported domain operations
  declare authored return contracts; inferred React and schema output stays inferred.
- Parse untrusted input with the existing schema library. Expected domain failures
  are Result values. Adapters translate expected third-party failures; the edge
  handles thrown faults.
- Use `unknown`, narrowing, and `satisfies` instead of escape hatches. `as const`
  is allowed; a branded constructor's single assertion needs a narrow, explained
  lint suppression, never a use-site assertion.

Use established tooling and review guidance rather than a custom architecture
checker. When enabling rules, fix their diagnostics across authored code,
including tests. Limit discretionary naming and ownership changes to the modules
being improved; exclude generated files and avoid unrelated style cleanup.

For future DDD assessment, follow the
[architecture review guidance](agents/domain.md#during-architecture-reviews).
