# 03: Generate the initial OpenAPI contract

**What to build:** Describe Hono requests and responses with runtime schemas and
generate an OpenAPI 3.1 document from the same definitions.

**Blocked by:** 02: Establish the HTTP response and failure spine

**Status:** done

- [x] The health, success, and Problem Details shapes have runtime schemas.
- [x] The server exposes a valid OpenAPI 3.1 document generated from route definitions.
- [x] Tests verify that actual health and failure responses satisfy their schemas.
- [x] The chosen Hono and schema integration follows current official documentation.
- [x] Generated documentation is checked for drift without introducing a handwritten duplicate contract.

## Comments

- Adopted `hono-openapi` per the `hono.dev/examples/hono-openapi` guide: plain
  `Hono` routes describe operations with `describeRoute`/`describeResponse`,
  and plain Zod 4 schemas (`.meta({ id })`) become `components.schemas`.
- Added `core/http/openapi.ts`, which serves the generated OpenAPI 3.1.0
  document at `GET /openapi.json`, documents the opaque `500` Problem Details
  response on every operation, and disables the library's built-in 400 body
  so validation failures stay on the Problem Details contract.
- Added a runtime schema for the `{ items, page: { nextCursor } }` collection
  success shape beside the existing health and Problem Details schemas.
- Contract tests validate the served document against the official OpenAPI
  3.1 schema, fail when any registered route lacks a documented operation, and
  check that actual health and fault responses match the media type and
  referenced schema the document declares. No handwritten contract file exists.
