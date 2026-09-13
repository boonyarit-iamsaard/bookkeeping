# Domain Docs

This repo uses a single-context layout: one root `CONTEXT.md` and root `docs/adr/`.

## Before exploring

Read root `CONTEXT.md` and ADRs in `docs/adr/` relevant to the area you will work in.

If these files are absent, proceed silently. The `/domain-modeling` skill creates them lazily when terms or decisions are resolved.

## File structure

```text
/
├── CONTEXT.md
├── docs/adr/
│   └── 0001-<decision-slug>.md
└── src/
```

## Use the glossary's vocabulary

When naming a domain concept in an issue title, refactor proposal, hypothesis, or test name, use the term defined in `CONTEXT.md`.

If a concept is absent from the glossary, reconsider whether the project uses it or note the gap for `/domain-modeling`.

## Flag ADR conflicts

If a proposal contradicts an existing ADR, identify the ADR and explain why the decision should be reopened.

## During architecture reviews

Assess whether domain-driven design (DDD) would now resolve concrete friction.
Raise it when domain invariants recur across modules and drift, the same term
acquires conflicting meanings, or distinct rule sets need separate ownership.
Show the affected code and a change or failure that the current feature-first
structure cannot handle clearly; size and directory counts alone are insufficient.

Recommend the smallest established DDD practice that addresses that evidence,
such as a domain-owned invariant, an aggregate for atomic consistency, or a
bounded context for genuinely different models. Explain its benefit over the
existing feature modules and typed contracts. Propose stronger enforcement when
the rule and ownership are clear and repeated violations justify it; use existing
tooling. Keep consistency with recognizable conventions as the goal rather than
introducing a bespoke framework. Record resolved domain terms in `CONTEXT.md`
and decisions in ADRs when they are hard to reverse, surprising without context,
and based on a real trade-off.
