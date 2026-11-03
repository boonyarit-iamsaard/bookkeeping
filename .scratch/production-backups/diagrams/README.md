# Production backup diagrams

Rendered with `pnpm diagrams`, as [the diagram kit guide](../../../docs/development/diagrams.md) describes.
Edit the `.diagram.html` source and render again; open it in a browser to
preview.

| Source                      | Shows                                                                            |
| --------------------------- | -------------------------------------------------------------------------------- |
| `architecture.diagram.html` | The nightly job, the S3 bucket and its rules, the alert, the drill and recovery. |
| `aws-access.diagram.html`   | How the owner reaches both AWS accounts, and where root fits.                    |

![Production backup architecture](architecture.light.png#gh-light-mode-only)
![Production backup architecture](architecture.dark.png#gh-dark-mode-only)
