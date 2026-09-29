# 01: Move to pnpm 11 with an integrity-hashed pin

**What to build:** the workspace installs, passes the routine gate and builds
both container images on pnpm 11.x, with the package manager pinned by version
and integrity hash. The build-script approvals move to an `allowBuilds` map,
because pnpm 11 ignores the legacy allowlist keys and fails the install on the
packages that need approval (esbuild, cpu-features, protobufjs, ssh2). Stay off
pnpm 12: `pnpm fetch --frozen-lockfile` was rejected there in one local run.
This is its own commit so a failure has one cause. See
`.scratch/supply-chain-hardening/spec.md` and
`docs/research/supply-chain-hardening.md`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The package manager pin names a pnpm 11.x version with its integrity hash, and corepack accepts it.
- [ ] Build-script approvals are an `allowBuilds` map covering every package that needs one; the legacy allowlist keys are gone.
- [ ] A clean `pnpm install --frozen-lockfile` succeeds with no ignored-build errors.
- [ ] `pnpm run ci` passes.
- [ ] `docker build` succeeds for both the API and web images, proving `fetch`, the filtered offline install, `deploy --legacy` and the package hook still work.
- [ ] The change is one commit; the agent stages it and gives the owner the commit command.
