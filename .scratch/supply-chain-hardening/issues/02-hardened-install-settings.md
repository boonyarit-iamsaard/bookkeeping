# 02: Hardened install settings and a pinned registry

**What to build:** installs refuse risky dependency behaviour, copied from the
sibling project `stay`: a release younger than three days is not installed, a
drop in publish trust fails the install, an unapproved build script fails the
install, and an engine or stale-install mismatch is a hard error. The registry
is pinned in the repository so a stray global npm config cannot redirect
installs. Urgent advisories use a per-package release-age exclusion, never a
lowered global value.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] Minimum release age is 4320 minutes, with a comment naming it as three days.
- [ ] `trustPolicy` is `no-downgrade` with a 30-day (43200 minute) ignore-after window and the explanatory comment.
- [ ] Strict dependency builds, engine strictness, verify-deps-before-run set to error, and store integrity verification are on; no blanket build allowance.
- [ ] A repository `.npmrc` pins the registry, and both Dockerfiles copy it.
- [ ] A clean install and `pnpm run ci` pass, and both images still build.
- [ ] On a scratch branch, an unapproved build script fails the install and a too-fresh release is refused; nothing from the scratch branch is kept.
- [ ] One commit, staged by the agent for the owner to run.
