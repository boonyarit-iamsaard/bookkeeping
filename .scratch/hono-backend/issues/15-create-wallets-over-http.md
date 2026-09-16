# 15: Create wallets idempotently over HTTP

**What to build:** Let an authenticated client create a wallet safely across
network retries using server-authoritative money and calendar-date validation.

**Blocked by:** 13: Introduce reusable creation idempotency; 14: Expose wallet list and detail reads

**Status:** ready-for-agent

- [ ] Wallet creation moves to the application package and remains the single operation used by Next.js and Hono.
- [ ] The HTTP request uses a semantic Money object and never converts through JavaScript `number`.
- [ ] A valid creation returns `201`, the direct wallet representation, and its canonical location.
- [ ] Missing or malformed idempotency keys, invalid inputs, replay, changed-payload conflict, and concurrency have stable contracts.
- [ ] Validation, application, HTTP, runtime-schema, and OpenAPI tests cover the complete behavior.
