# Codebase structure and naming research

Researched 2026-09-13. Scope: recognizable organization for this Next.js,
React, TypeScript application; filenames, symbols, and test classification.
This note records research and initial recommendations before the naming decisions.

Repository observations and recommendations describe the pre-refactor snapshot.
The implemented naming, ownership, and enforcement choices are in
[code conventions](../code-conventions.md), which supersede the initial recommendations.

## Findings from primary sources

### Next.js defines routing conventions, not a complete application taxonomy

Next.js documents `app`, optional `src`, routing files such as `page.tsx`,
`layout.tsx`, and `route.ts`, and organizational features such as route groups
and private folders. It explicitly permits different arrangements of ordinary
application code: outside `app`, inside `app`, or split by feature or route.
There is consequently no official Next.js rule requiring `core`, `shared`,
`features`, `lib`, or `components` as top-level application directories.
[Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure)

The repo's `src/app/(auth)` and `src/app/(app)` follow route-group conventions.
Its ordinary code outside `app` is also permitted. Calling the entire layout
“the standard Next.js structure” would overstate the documentation.

### Feature organization and matching names have documented precedent

Current Angular guidance recommends hyphen-separated filenames, names that
reflect the main identifier or common theme, colocated unit tests, and folders
organized by feature areas. It discourages generic file names such as `utils.ts`
and directories partitioned only by code kind, such as `components` and
`services`. It uses `.spec.ts` for unit tests; that suffix does not mean E2E.
[Angular style guide](https://angular.dev/style-guide)

The older Angular guide illustrated `core`, root `shared`, and feature folders,
and naming patterns such as `hero.component.ts`. That is historical precedent
for this repo's inspiration, rather than today's Next.js requirement.
[Angular v19 style guide](https://v19.angular.dev/style-guide)

The transferable ideas are feature locality and matching names. Angular-specific
bootstrap files, decorators, and type suffixes need no equivalent here.

### Bulletproof React is a named, documented feature-first reference

Bulletproof React organizes most application code under `features`, with shared
`components`, `hooks`, `config`, `lib`, and `utils` outside features. Feature-local
`components` and `hooks` are explicitly illustrated; only necessary directories
should exist. It recommends direct imports rather than feature barrel files,
and describes a dependency direction from shared code to features to application
composition. It also suggests preventing imports between features.
[Bulletproof React project structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)

This is a community architecture reference maintained by its author, not an
official React or Next.js specification. Its `app` folder explicitly varies
with the framework. Unlike current Angular's more concept-focused grouping,
its feature-local code-kind directories closely resemble this repo.

### Feature-Sliced Design supplies stronger taxonomy, with stronger commitments

Feature-Sliced Design defines named layers such as App, Pages, Widgets,
Features, Entities, and Shared. Imports generally target lower layers;
features cannot import other features. Its “feature” means a meaningful user
interaction, whereas entities represent domain concepts. Optional layers may
be omitted, but introducing arbitrary new layers is discouraged.
[Feature-Sliced layers](https://feature-sliced.design/docs/reference/layers)

FSD additionally defines public entry points for slices, often using `index.ts`.
That practice needs reconciliation with this house style's restriction on app
barrels. [Feature-Sliced public API](https://feature-sliced.design/docs/reference/public-api)

The current `features/wallets`, `features/categories`, and `features/transactions`
are domain areas rather than proof of FSD adoption. Implementing FSD would mean
reconsidering ownership and dependency rules, not simply matching directory names.

### Vitest explicitly documents integration-test suffixes

Vitest's current Test Projects configuration example uses project names `unit`
and `integration`, selected by `**/*.unit.test.ts` and
`**/*.integration.test.ts`. This establishes a first-party documented example,
not a mandatory naming standard. Projects and inclusion patterns are normal
Vitest mechanisms for giving suites different setup and execution settings.
[Vitest Test Projects](https://vitest.dev/guide/projects#configuration)

In this repo, `vitest.config.mts` routes `src/**/*.db.test.ts` to a project named
`db`, with PostgreSQL setup and sequential file execution. Ordinary
`src/**/*.test.ts` files run in `unit`, excluding the database suffix. The `.db`
segment is a local selection convention; it describes a dependency rather than
the scope of a test.

The wallet database suite calls `createWallet` and `listWallets` directly using a
real database and rollback fixture. It checks operations together with persistence,
without driving the application through its browser interface. Under Next.js's
definitions, that is integration testing. E2E testing exercises user flows in a
realistic environment. [Next.js testing types](https://nextjs.org/docs/app/guides/testing#types-of-tests)

Playwright accepts both `.spec` and `.test` by default and supports a configured
`testDir`. Thus `tests/e2e/wallets.spec.ts` is recognizable and already supported
without a bespoke selector. Its suffix alone does not establish test scope.
[Playwright test discovery](https://playwright.dev/docs/api/class-testconfig#test-config-test-match)

## Recommendation for this repo

Adopt a documented **feature-first structure inspired by Bulletproof React,
using Next.js routing conventions**, and retain the existing `core/shared/features`
layout initially. State that adaptation explicitly. Renaming `core` to `lib` and
splitting `shared` into several root directories would produce a closer visual
match, but would not by itself improve ownership or testability.

Keep Next.js entry points in `app`; keep wallet, category, and transaction code
near its owning feature; keep infrastructure setup in `core`; allow only reusable
code in `shared`. Avoid introducing every optional directory from a reference.
Revisit cross-feature restrictions separately: transactions naturally involve
wallets and categories, so copying a blanket restriction before identifying the
right seam could scatter related behavior and reduce locality. Nothing here
requires reopening ADR-0001's transaction-derived balance decision.

For tests, prefer `*.integration.test.ts` over `*.db.test.ts` and name the Vitest
project `integration`. Keep ordinary `*.test.ts` if minimal churn matters, or adopt
`*.unit.test.ts` for exact alignment with Vitest's example. Keep Playwright under
`tests/e2e/*.spec.ts`. Database helpers can retain descriptive database names:
infrastructure names and test-scope names answer different questions.

For filenames and symbols, follow kebab-case and recognizable names:
`create-wallet-form.tsx` / `CreateWalletForm` / `CreateWalletFormProps`, and
`use-create-wallet-form.ts` / `useCreateWalletForm`. A file exporting several
wallet operations can be `wallet-operations.ts`; one concept per file does not
require one function per file. Framework-required names remain exceptions.

Use the existing house style for TypeScript contracts and functions, without
presenting it as universal TypeScript practice. Prefer established lint rules
for filename case and identifier case, plus written guidance for semantic naming.
Biome documents configurable naming-convention checks, but a case checker cannot
decide whether a domain name is accurate.
[Biome naming conventions](https://biomejs.dev/linter/rules/use-naming-convention/javascript/)

The next concrete change should be a short conventions document and existing
tool configuration, followed by targeted renames. This preserves a recognizable
reference and avoids maintaining a custom architecture checker merely to impose
another local taxonomy.
