# 04: Re-sort Tailwind classes under the new rule

**What to build:** Class lists across the web app follow the order the
renamed `useTailwindSortedClasses` rule wants, so the 237 warnings it raises
go away. This is one mechanical, behaviour-neutral change, so apply the rule's
safe fix in batches by directory (for example `shared`, `core`, `features`)
and keep the diff reviewable. Class order can change CSS cascade results only
in rare conflicting-utility cases; check that the browser spec below still
passes.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] `biome ci` reports no class-sorting warnings.
- [ ] Only class string contents change in the diff.
- [ ] Web unit tests pass, and one focused SPA spec passes on one project.
- [ ] Any rule decision that differs from the old ordering (for example
      arbitrary values) is noted in the closing note.

## Comments
