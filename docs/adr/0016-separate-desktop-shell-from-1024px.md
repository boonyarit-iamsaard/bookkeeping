# A separate desktop shell from 1024px

Superseded by ADR 0017.

ADR 0006 made the client phone-first, and until now desktop was the phone
column with a header from 640px. That column leaves a wide window mostly
empty and gives desktop no room for denser layouts. From 1024px the signed-in
app now renders a separate desktop shell: a shadcn Sidebar that collapses to
icons and a 64px top bar with today's date, New transaction, and the account
menu. Below 1024px, tablets included, the phone chrome (title bar and tab
bar) applies; the 640px density step and sheets becoming dialogs stay where
they were. This amends ADR 0006's phone-first stance: phones still lead, but
desktop is a first-class layout rather than the phone column widened.

## Considered options

- Responsive classes on one tree: rejected because the shells differ in
  structure, not only in size, and hiding one with CSS still mounts both and
  leaves two navigation landmarks in the accessibility tree.
- A separate desktop app or routes: rejected because both shells serve the
  same URLs, and screens share their data hooks, forms, and domain rules.

## Consequences

- `_app.tsx` picks the shell with `useIsDesktop()`, a `matchMedia` on
  Tailwind's `lg`, so the switch follows a resize live. Crossing 1024px
  remounts the screen, which drops unsaved form input at that moment.
- A screen may give desktop its own composition on the same URL; one without
  renders its phone column in the content area, so every screen works on
  both shells.
- Entry forms stay full pages on both shells, and the report month stays per
  page.
- Desktop browser specs run tagged `@matrix` on the `desktop-chromium`
  project at 1280px.
