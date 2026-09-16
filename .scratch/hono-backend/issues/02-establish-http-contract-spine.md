# 02: Establish the HTTP response and failure spine

**What to build:** Give every Hono response consistent JSON, failure, and
correlation behavior before capability routes are added.

**Blocked by:** 01: Create the Hono server shell and health check

**Status:** done

- [x] Single-resource successes can be returned directly without a global data wrapper.
- [x] Failures use RFC 9457 Problem Details with stable bookkeeping URNs and matching kebab-case codes.
- [x] Unexpected faults return opaque internal-error problems without leaking exception details.
- [x] Every response carries a fresh server-generated request identifier that is available to request-scoped logging.
- [x] Contract tests verify statuses, media types, bodies, and request identifiers.

## Comments

- Added app-level request context middleware that generates a fresh server-owned
  `X-Request-Id`, stores it as `requestId`, and applies it to successful,
  failure, and bodyless responses.
- Added RFC 9457 Problem Details mapping for not-found, Hono HTTP exceptions,
  and unexpected faults. Unexpected responses expose only the stable
  `internal-error` contract while the server log retains the request context.
- Added in-process HTTP contract coverage for direct JSON success bodies,
  request-ID freshness and trust boundaries, request-scoped visibility, 404
  Problem Details, opaque 500 handling, and 204 responses.
