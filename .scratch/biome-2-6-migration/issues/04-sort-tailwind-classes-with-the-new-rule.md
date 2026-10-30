# 04: Re-sort Tailwind classes under the new rule

**What to build:** Class lists across the web app follow the order the
renamed `useTailwindSortedClasses` rule wants, so the 237 warnings it raises
go away. This is one mechanical, behaviour-neutral change, so apply the rule's
safe fix in batches by directory (for example `shared`, `core`, `features`)
and keep the diff reviewable. Class order can change CSS cascade results only
in rare conflicting-utility cases; check that the browser spec below still
passes.

**Blocked by:** 01.

**Status:** done (fdf26a2)

- [x] `biome ci` reports no class-sorting warnings.
- [x] Only class string contents change in the diff.
- [x] Web unit tests pass, and one focused SPA spec passes on one project.
- [x] Any rule decision that differs from the old ordering (for example
      arbitrary values) is noted in the closing note.

## Comments

Done 2026-10-30 in c3b2c1c, 487e34e and fdf26a2, one commit each for `shared`,
`core` with `routes`, and `features`. The safe fix
(`biome lint --only=nursery/useTailwindSortedClasses --write`) reordered 62
files. Every file keeps its line count, so only class string contents changed.
`biome ci` reports no class-sorting warnings, the web unit tests pass (229),
and `shell.spec.ts` passes on `phone-chromium`. No rule decision differed from
the old ordering. The fix needed no manual edits and added no ignores.
