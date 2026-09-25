# Railway hosts the API, the web client, and PostgreSQL

The app has one user, in Thailand, who captures transactions on the phone
seconds after paying, so the latency of the first save after idle matters and
throughput does not. We deploy everything to one Railway Hobby project in
Singapore: the Hono server as a Node.js container, the static SPA as a Caddy
container, and Railway-managed PostgreSQL 18, within a $10 monthly budget. The
client and API keep separate origins under one site, as ADR 0003 decided:
`bookkeeping.boonyarit.me` and `api.bookkeeping.boonyarit.me`, CNAMEs at the
domain's existing DNS host.

## Considered options

- Cloudflare Workers with Neon free: rejected. Workers would add a second
  runtime beside the Node.js one ADR 0003 chose and the tests exercise, with
  per-request connections and an external store for auth rate limiting, only
  to save a few dollars. Neon's free tier suspends compute when idle, which
  puts a wake-up delay on nearly every capture for a single user.
- Static client on Cloudflare Pages or Vercel with the API on Railway:
  rejected for cohesion. The service worker precaches the shell, so an edge
  CDN adds almost nothing after the first visit, and one provider means one
  dashboard, one deploy mechanism, and private networking to the database.

## Consequences

- The personal site's DNS host and nameservers stay unchanged; the API record
  is not proxied through a CDN.
- Deploys come from Railway's GitHub integration on `main`, gated on CI. One
  environment serves as a trial with disposable data.
- Recording real financial data waits for a migration strategy and for
  automated backups stored off Railway; a backup kept with the same provider
  does not cover losing access to that account.
- Production disables public sign-up once the owner's account exists.
