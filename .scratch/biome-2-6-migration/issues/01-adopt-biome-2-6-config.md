# 01: Adopt Biome 2.6 and its renamed class-sorting config

**What to build:** The repo runs Biome 2.6.x with a configuration it accepts.
The nursery rule `useSortedClasses` is now `useTailwindSortedClasses`, and its
`functions` option moves to a top-level `tailwind` block (`clsx` and `cn` as
merge functions, `cva` as a variant function). Make only that edit; do not
run `biome migrate --write`, which re-indents the whole file with tabs. This
replaces the Biome bump in the Dependabot dev-dependencies PR (#53).

**Blocked by:** None (can start immediately).

**Status:** done (7563f13)

- [x] `@biomejs/biome` is pinned to 2.6.x in the lockfile and manifest.
- [x] `biome.json` loads without a configuration error, with its indentation
      and the rest of its rules unchanged.
- [x] The class-sorting rule still applies to `clsx`, `cn` and `cva` calls.
- [x] Remaining findings are only the ones owned by tickets 02 to 04.

## Comments

Reproduced 2026-10-29 on the #53 branch: `biome ci` reported 25 errors and 243
warnings after this config fix alone.

Done 2026-10-29 in 7563f13. Pinned 2.6.3, the newest 2.6.x outside the
`minimumReleaseAge` window; 2.6.4 is re-pinned in ticket 05. On 2.6.3 `biome ci`
reports 29 errors and 243 warnings: 237 class-sort warnings (04), 8 lint
errors (02) and the format findings (03).
