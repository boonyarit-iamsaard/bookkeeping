# 03: Resolve the markdown format findings

**What to build:** `biome ci` and `pnpm format:check` agree about the
`.scratch` Markdown docs. Biome 2.6 reports about 20 of them (specs, issues
and runbooks) as unformatted. Decide whether Biome should format Markdown at
all, given that Prettier already owns `*.md`: either exclude Markdown from
Biome's file includes, or format the files and confirm Prettier accepts the
result. Prefer exclusion if the two formatters disagree. Record the decision
in the closing note.

**Blocked by:** 01.

**Status:** done (181cba1)

- [x] `biome ci` reports no format findings.
- [x] `pnpm format:check` and `pnpm lint:md` still pass.
- [x] No ticket or spec content changes beyond whitespace.

## Comments

Closing note: Prettier keeps Markdown. Biome 2.6 formats `*.md` itself, so
`biome.json` now excludes `**/*.md` (one formatter per file type, as with
HTML) rather than reformatting the `.scratch` docs a second way. Biome 2.6 also
started formatting YAML and flagged `pnpm-lock.yaml`, which `.prettierignore`
already skips as a never-reformat lockfile; it is excluded from Biome too. No
ticket or spec content changed. `biome ci` reports no format findings;
`pnpm format:check` and `pnpm lint:md` pass.
