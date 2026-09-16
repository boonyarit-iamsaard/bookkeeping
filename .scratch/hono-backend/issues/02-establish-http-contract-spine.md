# 02: Establish the HTTP response and failure spine

**What to build:** Give every Hono response consistent JSON, failure, and
correlation behavior before capability routes are added.

**Blocked by:** 01: Create the Hono server shell and health check

**Status:** ready-for-agent

- [ ] Single-resource successes can be returned directly without a global data wrapper.
- [ ] Failures use RFC 9457 Problem Details with stable bookkeeping URNs and matching kebab-case codes.
- [ ] Unexpected faults return opaque internal-error problems without leaking exception details.
- [ ] Every response carries a fresh server-generated request identifier that is available to request-scoped logging.
- [ ] Contract tests verify statuses, media types, bodies, and request identifiers.
