# A Vite and TanStack Router single-page client replaces Next.js

ADR 0003 deferred the choice of web runtime and left Next.js as a temporary
adapter over the application operations. The product goal is a phone-first web
application installed as a PWA, with no React Native or native wrapper planned,
so we replace Next.js with a static single-page client built with Vite and
TanStack Router that talks only to the Hono API. A static shell is the natural
PWA shape, it removes the second backend and the second Better Auth mount, and
it makes Hono the sole application backend in practice, not only in intent.

## Considered options

- TanStack Start: rejected because server rendering and server functions
  reintroduce a web server runtime beside Hono, which is the situation this
  decision ends.
- Keeping Next.js as the permanent client calling Hono over HTTP: rejected
  because it keeps a server runtime the product does not need and complicates
  service-worker caching around server-rendered pages.
- Expo or React Native: rejected; no current requirement needs a native
  capability, and a thin native wrapper around the same web client is the
  first escape hatch if one appears.

## Consequences

- The browser calls Hono directly with credentialed requests, host-only API
  cookies, and the exact origin allowlist ADR 0003 defined; client and API stay
  on separate origins.
- Reads and writes go through a typed client generated from the
  contract-tested OpenAPI document, so the client cannot silently drift from
  the API. TanStack Query owns cached reads; TanStack Form, shadcn with Base
  UI, and Tailwind carry over.
- The PWA baseline is a manifest, icons, standalone display, and a service
  worker that precaches the shell and static assets, never API responses, with
  an offline fallback page. Financial writes require connectivity; offline
  capture is a separate, unscheduled decision.
- The Next.js app is renamed `apps/legacy-web` first, and the new client is
  scaffolded as `apps/web` so the permanent name is never renamed. Routes port
  one at a time in sign-in, wallets, categories, transactions, dashboard
  order; each ported route retires its legacy browser spec, and the legacy app,
  its Better Auth mount, and the frozen suite are deleted with the last route.
- New browser specs run on 360px Chromium, iPhone WebKit, and desktop
  Chromium. The phone-first redesign of each screen is a separate effort after
  the port; the port is verified against existing behavior.
