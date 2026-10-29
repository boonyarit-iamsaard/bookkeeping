# 03: Resolve the markdown format findings

**What to build:** `biome ci` and `pnpm format:check` agree about the
`.scratch` Markdown docs. Biome 2.6 reports about 20 of them (specs, issues
and runbooks) as unformatted. Decide whether Biome should format Markdown at
all, given that Prettier already owns `*.md`: either exclude Markdown from
Biome's file includes, or format the files and confirm Prettier accepts the
result. Prefer exclusion if the two formatters disagree. Record the decision
in the closing note.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] `biome ci` reports no format findings.
- [ ] `pnpm format:check` and `pnpm lint:md` still pass.
- [ ] No ticket or spec content changes beyond whitespace.

## Comments
