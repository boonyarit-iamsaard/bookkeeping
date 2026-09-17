# Dotenvx, Turborepo, and Next.js environment injection

Researched 2026-09-17. Scope: cross-platform environment injection for the
root E2E gate and the Next.js workspace.

## Recommendation

Put environment injection at the process-launch **seam**:

- `apps/web` declares `@dotenvx/dotenvx` because its `build`, `start`, and E2E
  scripts invoke it;
- the root remains a thin Turborepo orchestrator and does not declare dotenvx;
- fixed, non-secret, single-value controls use `dotenvx run --env KEY=value`;
- application secrets remain in `apps/web/.env` for Next.js to load normally;
- `apps/web/turbo.json` declares the web-only values that affect `build` and
  `test:e2e:ci` task behavior.

The shell-neutral scripts are:

```jsonc
// package.json
{
  "scripts": {
    "ci:e2e": "turbo run test:e2e:ci"
  }
}
```

```jsonc
// apps/web/package.json
{
  "scripts": {
    "build": "dotenvx run --env SKIP_ENV_VALIDATION=1 -- next build",
    "dev": "next dev -p 4000",
    "start": "dotenvx run --env PORT=4000 -- next start",
    "test:e2e:ci": "dotenvx run --env CI=1 -- tsx tests/e2e/run.ts"
  }
}
```

Dotenvx officially supports inline values and can combine them with file
injection when a real environment profile contains several values.
[Dotenvx inline environment values](https://dotenvx.com/docs/advanced/run-env)
Existing process variables still take precedence without `--overload`, so CI or
deployment-provided values can replace these local defaults.
[Dotenvx environment precedence](https://dotenvx.com/docs/advanced/run-environment-variable-precedence)

Dedicated files for `CI=1`, `PORT=4000`, or `SKIP_ENV_VALIDATION=1` would add
interface without hiding meaningful implementation. The existing
`apps/web/.env.ci.example` remains useful as the complete public fixture that
GitHub Actions and `act` copy to `apps/web/.env`.

## Dependency ownership

Dotenvx's official Turborepo guide installs `@dotenvx/dotenvx` in the workspace
whose scripts invoke it and tells Turborepo about values that affect task
outputs. Keeping every invocation in `apps/web` therefore avoids redundant root
ownership.
[Dotenvx Turborepo monorepo guide](https://dotenvx.com/docs/monorepos/turborepo),
[Dotenvx Turborepo guide](https://dotenvx.com/docs/turborepo/)

The root `ci:e2e` script names the Turbo task only. The web workspace owns both
the CI-mode adapter and the Playwright runner behind that task.

## Next.js loading versus pre-launch injection

Next.js 16.3.5 loads standard `.env*` files from the app root and gives existing
`process.env` values precedence. Application configuration such as
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `DATABASE_URL` should therefore
remain in `apps/web/.env`; wrapping Next merely to reload that file adds no
leverage. See the installed guide at
`apps/web/node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`
and the
[Next.js environment-variable guide](https://nextjs.org/docs/app/guides/environment-variables).

`PORT` is an exception. `next start` accepts it, but Next.js cannot obtain it
from its own `.env` loader because the HTTP server boots first. It must be a CLI
argument or be injected before `next start` launches. The inline value supplies
the local default while an existing platform-provided `PORT` remains
authoritative. See the installed CLI guide at
`apps/web/node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`
and the
[Next.js CLI reference](https://nextjs.org/docs/app/api-reference/cli/next#changing-the-default-port).

`SKIP_ENV_VALIDATION` is also a pre-launch control: it must exist when the web
environment module is imported during `next build`. Keeping it inline confines
the bypass to builds. Putting it in `apps/web/.env` would disable validation for
development and production startup too.

## Turborepo hashing

Turborepo 2.10.13 defaults to strict environment mode. Values declared with a
task's `env` are available to that task and affect its cache key, while
`passThroughEnv` values do not affect the cache key. The installed primary
reference is `node_modules/turbo/schema.json`; the same rules are in
[Turborepo's configuration reference](https://github.com/vercel/turborepo/blob/main/apps/docs/content/docs/reference/configuration.mdx).

Use `env`, not `passThroughEnv`, here:

- `SKIP_ENV_VALIDATION` changes whether a build validates configuration;
- `CI` changes Playwright retries, reporting, focused-test enforcement, and
  whether its managed web server runs `next dev` or `next start`.

Both values therefore alter task behavior. Package-local configuration gives
better locality than root `globalEnv`:

```jsonc
// apps/web/turbo.json
{
  "$schema": "../../node_modules/turbo/schema.json",
  "extends": ["//"],
  "tasks": {
    "build": { "env": ["SKIP_ENV_VALIDATION"] },
    "test:e2e": {},
    "test:e2e:ci": { "dependsOn": ["build"], "env": ["CI"] }
  }
}
```

Turborepo supports package configuration through `extends: ["//"]`, including
package-specific environment declarations.
[Turborepo package configuration](https://github.com/vercel/turborepo/blob/main/apps/docs/content/docs/reference/configuration.mdx#extends)

## Rejected layouts

- **POSIX assignments in package scripts:** fail under PowerShell and cmd.
- **One-value environment files:** add a shallow interface for fixed public
  controls that dotenvx can inject inline.
- **Root dotenvx dependency:** is redundant when the root only orchestrates a
  web-owned Turbo task.
- **Put `SKIP_ENV_VALIDATION` in `apps/web/.env`:** leaks a build-only bypass
  into development and runtime validation.
- **Use `passThroughEnv`:** permits behavior-changing values without including
  them in the corresponding cache key.
