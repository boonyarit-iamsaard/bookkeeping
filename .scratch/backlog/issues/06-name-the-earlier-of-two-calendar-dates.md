# 06: Name the earlier of two calendar dates

**What to build:** `getClosingBalances` in
`packages/application/src/transactions/transaction.ts` picks the earlier of
two `CalendarDate`s with `const [last] = [end, today].sort()`. That works
because ISO dates sort chronologically, but nothing says so. Add an
`earlierOf(a, b)` helper to `packages/domain/src/dates/dates.ts`, next to
`addDays`, and call it there. Biome 2.6's `useMathMinMax` flags the plain
ternary, and its `Math.min` fix returns `NaN` on date strings, so a named
helper is the readable way out.

**Blocked by:** None.

**Status:** done (5431ea8)

**Notes:** Came from the review of biome-2-6-migration ticket 02. The file is
at its token-budget baseline, so the call site must not grow it; the helper
and its test live in the domain package. Unit-test the helper, including equal
dates and the month and year boundaries. If a second call site for a bigint
min/max appears, consider a shared helper then.

- [x] `earlierOf` is exported from the domain dates module with a unit test.
- [x] `getClosingBalances` calls it and its tests pass unchanged.
- [x] `transaction.ts` is no larger than its baseline.

## Comments
