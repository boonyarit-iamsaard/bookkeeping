# Diagrams

A diagram is an HTML page named `*.diagram.html`, kept beside the spec or
document it illustrates, and rendered to PNG by Playwright. The browser does
the layout: groups and cards are ordinary elements arranged with the layout
helpers in `docs/diagrams/kit.css`, which also holds the shared look and its
light and dark colours. Edges are declared by the ids they join, and
`docs/diagrams/kit.js` draws them after layout, so moving a card moves its
edges:

```html
<a-edge from="cron" to="bucket" variant="accent">PutObject only</a-edge>
```

`kit.js` documents the edge attributes: sides, dashed and accent variants,
curve reach, and label placement. Start a new diagram from an existing one,
link the kit with relative paths, and load `kit.js` as a classic `defer`
script, because browsers refuse module scripts from `file://` pages. Give the
`.diagram` figure an `aria-label` that says what the diagram shows. Text that
must keep its spacing goes in a `<pre>`, which Prettier leaves alone.

Rendering launches Playwright's Chromium; install it once with
`pnpm --filter @bookkeeping/web exec playwright install --with-deps chromium`
(also in [testing](testing.md)). Render every diagram, or only the ones named:

```bash
pnpm diagrams
pnpm diagrams .scratch/production-backups/diagrams/architecture.diagram.html
```

Each run writes `<name>.light.png` and `<name>.dark.png` at twice the size,
cropped to the figure, beside the source. Commit both, and check them for
labels that collide or cross a border. Fonts come from Google Fonts, so
rendering needs the network. In Markdown, show the image that matches the
reader's theme:

```markdown
![Architecture](architecture.light.png#gh-light-mode-only)
![Architecture](architecture.dark.png#gh-dark-mode-only)
```

When a diagram only needs to read inside a GitHub document, such as a quick
flow in a spec or a pull request, a Mermaid block is the fallback: GitHub
renders it with no build step, at the cost of layout control.
