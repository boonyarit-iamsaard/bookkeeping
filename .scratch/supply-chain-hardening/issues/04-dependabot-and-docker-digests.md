# 04: Dependabot and Docker digest pins

**What to build:** dependency, Action and base-image pins stay current without
manual work, and a re-pushed image tag cannot change what production runs.
Dependabot covers npm, GitHub Actions and one Docker entry for each Dockerfile
directory (its fetcher is not recursive), weekly with a three-day cooldown,
grouped minor and patch updates, and the Node major ignored so the runtime moves
when the owner decides. Both Dockerfiles pin `node:24-slim` and `caddy:2-alpine`
by index digest, keeping the tag in the reference so Dependabot can update both.
Re-resolve the digests on the day; the research note's values may be stale.

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] Dependabot config has npm, github-actions, and a docker entry for each of the API and web Dockerfile directories.
- [ ] Cooldown is three days; minor and patch are grouped for dev and prod dependencies; the Node major update is ignored.
- [ ] Both base images are pinned by index digest with the tag retained, and the digests were freshly resolved.
- [ ] `docker build` succeeds for both images.
- [ ] `pnpm run ci` passes.
- [ ] One commit, staged by the agent for the owner to run.
