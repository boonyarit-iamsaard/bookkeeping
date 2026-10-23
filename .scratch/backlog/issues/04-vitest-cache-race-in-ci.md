# 04: Vitest cache race fails `pnpm run ci` at startup

Read `README.md#checks` first.

**What to build:** `pnpm run ci` never fails because two Vitest runs touch
the same cache directory at once.

**Blocked by:** None

**Status:** done

**Notes:** Fixed in `1dc4383`. Diagnosis and verification are recorded below.

- [x] Find which runs share `node_modules/.vitest-cache` at the repository root, and why it is emptied while another run reads it.
- [x] A fix that keeps Turborepo's task parallelism, for example a separate cache directory per Vitest run.
- [x] Repeated `pnpm run ci` runs show no `ENOTEMPTY` startup error.

## Comments

### 2026-10-23: seen once

The first `pnpm run ci` on `feat/production-backups` failed in
`//#test:scripts` before any test ran:

```text
Startup Error
Error: ENOTEMPTY: directory not empty, rmdir '<repo>/node_modules/.vitest-cache'
```

`pnpm run test:scripts` on its own then passed (5 files, 32 tests), and two
later full `pnpm run ci` runs passed. Turborepo runs `test` (every workspace)
and `//#test:scripts` (the root `vitest.config.mts`) in one `turbo run`, in
parallel. Vitest is 5.0.5. Each workspace has its own `node_modules/.vite`,
but `.vitest-cache` exists only at the root, so something other than the
root run may be writing there. That part is unconfirmed. Not seen in GitHub
Actions so far.

### 2026-10-23: diagnosed and closed

Implemented in `1dc4383` on `fix/vitest-cache-race`.

All seven Vitest invocations (the root script suite and six workspaces)
defaulted to the monorepo root's filesystem module cache. This is separate
from Vite's `.vite` caches. Vitest 5.0.5's `ensureCacheIntegrity` reads
`_metadata.json`; when its `lockfileHash` is stale, it calls `clearCache`,
which recursively removes the module cache without coordinating with other
processes. One invocation can finish clearing and start writing modules or
metadata while another is still deleting, making the latter's `rmdir` fail
with `ENOTEMPTY`. The shared default is documented in
[Vitest's filesystem cache reference](https://vitest.dev/config/fsmodulecachepath).

The initial uncached Turbo run did not reproduce this error; its integration
suites could not reach Docker from the sandbox. Fifteen concurrent unit-test
attempts with a valid cache passed, as did fifteen with stale metadata but
little cached content. The reduced reproduction populated the root cache
with 1,000 disposable files and metadata
`{"lockfileHash":"stale-repro"}`, then started the real root commit-body test
and domain result test concurrently, with one worker each. It failed on the
first attempt in two independent runs, taking about one second:

```text
Startup Error
Error: ENOTEMPTY: directory not empty, rmdir '<repo>/node_modules/.vitest-cache'
```

The same populated, stale cache passed with only one Vitest process. Changing
only `fsModuleCachePath` to a directory per invocation passed all fifteen
concurrent attempts, supporting the cross-process deletion explanation and
ruling out Vite's separate cache as the conflicting directory.

Every config now explicitly sets `test.fsModuleCachePath` to
`node_modules/.vitest-cache`. An explicit relative path resolves from that
invocation's root, whereas Vitest's implicit default resolves from the
workspace root. The root script suite keeps its cache and each package or
app uses its own. Turborepo task parallelism is unchanged. The convention is
recorded in `docs/code-conventions.md`.

The permanent regression command is:

```sh
pnpm run test:scripts scripts/vitest-cache.unit.test.ts
```

It copies all seven real configs into a disposable monorepo, populates each
invocation's cache, and runs the real Vitest `--clearCache` command for each
invocation in turn. It asserts that the caller clears its own cache while
every other invocation's cached module survives. This uses the same module
cache deletion path as lockfile invalidation, without a timing-dependent
assertion. The test failed before the fix when a workspace deleted the root
suite's cached module; it passes after the fix. The fixture is removed on
success or failure.

Verification:

- The reduced two-process reproduction passed fifteen consecutive attempts
  after the config change, without a CLI cache-path override.
- The original three-process reproduction (root, domain, web; 3,000 cached
  files) also passed fifteen consecutive attempts after the fix.
- Two host runs of `env TURBO_FORCE=true pnpm run ci` passed: 89 test files,
  720 tests each, all type checks and lint checks, then both builds. Tests
  took 1m10s and 1m11s; builds took 9s and 7s. Both runs executed all Turbo
  tasks without cache hits. Docker-backed integration and Hono contract
  coverage passed; no browser boundary changed.
- The temporary reproduction scripts were removed; no debug instrumentation
  was added to the application or its dependencies.
