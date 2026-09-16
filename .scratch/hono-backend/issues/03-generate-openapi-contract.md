# 03: Generate the initial OpenAPI contract

**What to build:** Describe Hono requests and responses with runtime schemas and
generate an OpenAPI 3.1 document from the same definitions.

**Blocked by:** 02: Establish the HTTP response and failure spine

**Status:** ready-for-agent

- [ ] The health, success, and Problem Details shapes have runtime schemas.
- [ ] The server exposes a valid OpenAPI 3.1 document generated from route definitions.
- [ ] Tests verify that actual health and failure responses satisfy their schemas.
- [ ] The chosen Hono and schema integration follows current official documentation.
- [ ] Generated documentation is checked for drift without introducing a handwritten duplicate contract.
