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
