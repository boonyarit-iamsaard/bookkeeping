# 18: The ＋ tab is announced as just "New"

Read `../spec.md` first.

**What to build:** The phone tab bar's ＋ says what it creates to assistive technology, matching the desktop header's "New transaction".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Out of scope:** the visible word under ＋.

- [ ] The ＋ tab's accessible name is "New transaction" while its visible word stays "New".
- [ ] The shell spec finds the ＋ tab by the name "New transaction" on phone.

## Comments

From 07's milestone critique (2026-09-24): P3, material (WCAG 2.4.4 link purpose). `apps/web/src/core/shell/tab-bar.tsx:58`. The visible label can stay short; the accessible name should start with it (WCAG 2.5.3).

Triaged (2026-09-24): in scope with the rest of 12–18, after 13.
