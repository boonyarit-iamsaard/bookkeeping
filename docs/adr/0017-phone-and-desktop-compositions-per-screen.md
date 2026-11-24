# A phone and a desktop composition per screen

Supersedes ADR 0016.

ADR 0016 gave desktop its own shell from 1024px but let each screen decide how
to differ, and the decision spread: `useIsDesktop()` ran in fifteen files,
including feature components and skeletons; shared components hid parts with
`lg:hidden`; and the entry form became the desktop dialog through a dialog
variant on every class. Screens on desktop were the phone column stretched,
and changing one layout risked the other. Every signed-in screen now has two
compositions, a phone one below 1024px and a desktop one from 1024px, and its
route alone picks between them. Both compositions share data reads, form
logic, field components, and domain rules; they share no layout.

- `features/<feature>/screens/<screen>.phone.tsx` and `<screen>.desktop.tsx`
  sit side by side; shared parts stay in `features/<feature>/components/`. A
  route's loading skeleton is picked the same way.
- `useIsDesktop()` is allowed only in `routes/` and `core/shell/`, and `lg:`
  classes only in `core/shell/`; a desktop composition never renders below
  1024px, so it needs none. Lint enforces both. `sm:` density steps stay
  allowed everywhere.
- Every phone composition uses one column width, so navigating never changes
  it; a form keeps its line length by narrowing its fields, not the page.
- From 1024px New and Edit open in a dialog, and a direct URL to an entry form
  renders the same desktop form as a page. The phone form is a separate
  composition built from the same fields, not the phone form restyled. This
  replaces ADR 0016's entry forms staying full pages on both shells.
- Desktop tables use one shared `DataTable` on TanStack Table, with sortable
  headers, a row menu, column visibility, rows per page, and page numbers
  (ADR 0018). It has no row selection, as no bulk operation is planned.

## Considered options

- Responsive classes and variants on one tree: rejected because it is the
  coupling this replaces; a phone change could break desktop unseen.
- `<PhoneOnly>`/`<DesktopOnly>` wrappers anywhere in the tree: rejected
  because the switch would still spread through feature components.
- `phone/` and `desktop/` folders per feature: rejected because the two
  compositions of one screen belong next to each other.

## Consequences

- Crossing 1024px still remounts the screen and drops unsaved form input, as
  under ADR 0016; nobody resizes mid-entry often enough to keep a draft.
- Screens move one at a time; the lint rules warn until the last one has
  moved, then fail.
