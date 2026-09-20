# Code conventions

## Structure and ownership

Use feature-first organization following the
[Bulletproof React reference](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md),
with Next.js routing conventions and the TypeScript house style. The goal is
consistency with recognizable conventions, rather than a new architecture
framework. See [the supporting research](research/codebase-structure-and-naming.md).

Keep the `core`, `shared`, and `features` roots. Feature code stays with its
feature, infrastructure setup stays in `core`, and reusable code stays in
`shared`. Create additional directories only when needed.

Vocabulary and exact value behavior that persistence and both apps need live in
`@bookkeeping/domain` under feature directories such as `packages/domain/src/wallets/`,
exposed as subpaths such as `@bookkeeping/domain/wallets`. The package has no
React, Next.js, Hono, Drizzle, environment, or presentation code; labels and
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

| Purpose                  | Filename                    | Symbols                                     |
| ------------------------ | --------------------------- | ------------------------------------------- |
| Wallet behavior          | `server/wallet.ts`          | `createWallet`, `listWallets`               |
| Server Actions           | `server/wallet.actions.ts`  | `createWalletAction`                        |
| Shared wallet vocabulary | `wallet.types.ts`           | `WalletType`, `WalletSummary`               |
| Wallet labels            | `wallet-labels.ts`          | `WALLET_TYPE_LABELS`                        |
| Create form              | `create-wallet-form.tsx`    | `CreateWalletForm`, `CreateWalletFormProps` |
| Form hook                | `use-create-wallet-form.ts` | `useCreateWalletForm`                       |

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
gateway in `apps/server/src/testing/`. Real Better Auth over HTTP is covered by
the gateway integration test only.

Web integration tests exist only for the temporary Next.js adapter's own
boundary, the session, until the adapter is removed.

Budget: `pnpm test`, as Turborepo runs it with packages in parallel, completes
in three minutes or less on the development machine (2 CPUs, 5 GB). Check it
by hand; it is not gated in CI, which keeps CI free of hardware-dependent
flakes.

Helpers shared by a workspace's Vitest tests live in its `src/testing/`
directory, following the Bulletproof React reference; neither Hono nor Vitest
prescribes a location. The database package exposes its fixtures as
`@bookkeeping/database/testing`, and the server keeps its unit and integration
app factories in `apps/server/src/testing/`. Playwright helpers stay beside the
specs in `apps/web/tests/e2e/helpers/`. Test helpers are excluded from production
builds.

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
  Next.js generated props helpers can be wrapped in `Readonly` directly.
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
