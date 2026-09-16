# HTTP JSON response contract

Researched 2026-09-16. Scope: success bodies, cursor-paginated
collections, errors, and request correlation for the planned Hono API consumed by
the first-party SPA and a possible future Expo client.

## Recommendation

Use the smallest response shape that represents the HTTP result:

- return a single resource directly, without a global `{ "data": ... }`
  wrapper;
- return collections in an `{ "items": [...], "page": { ... } }` envelope so
  pagination metadata has a natural peer to the items;
- return failures as RFC 9457 Problem Details with the media type
  `application/problem+json` and a stable domain `code` extension;
- return a server-generated `X-Request-Id` response header on every response,
  including failures and bodyless responses, and do not repeat it in ordinary
  bodies.

This is a conventional resource-oriented contract rather than JSON:API. Google
API guidance likewise defines Get, Create, and Update methods as returning the
resource itself, while paginated List responses contain both a repeated
resource field and a continuation token.
[Google AIP-131](https://google.aip.dev/131),
[Google AIP-133](https://google.aip.dev/133),
[Google AIP-134](https://google.aip.dev/134),
[Google AIP-158](https://google.aip.dev/158)

All nonempty successful JSON bodies use `Content-Type: application/json`.
Failures use `Content-Type: application/problem+json`. Every request and
response shape is described by a runtime schema and exercised by contract
tests, including error extensions and nullable pagination fields.

## Successful single-resource responses

A successful fetch returns the resource directly:

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Request-Id: 0199...

{
  "id": "0199...",
  "name": "Cash",
  "balance": { "value": "125.50", "currency": "THB" }
}
```

Creation returns the created resource in the same shape and identifies its
canonical resource URI with `Location`:

```http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /wallets/0199...
X-Request-Id: 0199...

{
  "id": "0199...",
  "name": "Cash",
  "balance": { "value": "0.00", "currency": "THB" }
}
```

RFC 9110 defines `201 Created` as creating one or more resources and identifies
the primary created resource with `Location` when that header is present.
[RFC 9110 section 15.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.2)

Do not impose `{ "data": resource }` on every success. It adds a nesting level
without carrying metadata and makes the first-party clients unwrap every
ordinary result. If a later endpoint genuinely returns peer metadata, define a
specific response object for that operation instead of changing the global
contract.

## Collection responses and cursors

Return every potentially growing collection in an envelope from its first
version:

```json
{
  "items": [
    {
      "id": "0199...",
      "amount": { "value": "125.50", "currency": "THB" }
    }
  ],
  "page": {
    "nextCursor": "eyJvcmRlciI6Li4ufQ"
  }
}
```

At the end of the collection, keep the runtime shape stable and return an
explicit null:

```json
{
  "items": [],
  "page": {
    "nextCursor": null
  }
}
```

The request shape is `?limit=50&cursor=<opaque-token>`. The server owns the
cursor; clients store and replay it but never parse, edit, or construct it. A
cursor must bind to the ordering and relevant filters so it cannot silently be
reused for a different query. Page size is server-capped. Do not include
`totalCount` until a concrete product interaction requires it.

Google's pagination guidance warns that adding pagination later is a breaking
change, specifies an opaque continuation token, and requires subsequent
requests to keep other arguments consistent. Its protobuf convention uses an
absent/empty token at the end; this JSON contract deliberately chooses `null`
because `string | null` is an explicit, invariant runtime-described field.
[Google AIP-158](https://google.aip.dev/158)

The collection-only envelope is not a reason to wrap single resources. Its
purpose is to place page metadata beside `items`, leaving room for a future
`previousCursor` or endpoint-specific collection metadata without changing
each item.

## Problem Details errors

Use RFC 9457 Problem Details rather than inventing
`{ "error": { "code": ..., "details": ... } }`. A domain failure has this
shape:

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json
X-Request-Id: 0199...

{
  "type": "https://api.example.com/problems/wallet-archived",
  "title": "Wallet is archived",
  "status": 409,
  "code": "wallet-archived",
  "detail": "Transactions cannot be added to this wallet.",
  "details": {
    "walletId": "0199..."
  }
}
```

The members have these contracts:

- `type` is the canonical problem-type URI and primary problem identifier. Use
  `https://<owned-domain>/problems/<code>`, choosing the owned production domain
  before the contract is frozen. The example domain in this note is a
  placeholder. Emit that same canonical URI from local, staging, and production
  rather than deriving it from the request origin.
- `code` is a required, stable, kebab-case extension used for ergonomic
  discriminated unions in TypeScript clients. It has a tested one-to-one
  mapping with `type`; clients may branch on `code`, never on prose.
- `title` is a stable English summary for developers. It is not localized UI
  copy.
- `status` repeats the actual HTTP response status and is always kept in sync
  with it.
- `detail` is optional, occurrence-specific human guidance. Clients must not
  parse it.
- `details` is optional structured domain context. Its shape is defined per
  `code`; money inside it uses the API's semantic Money object.

RFC 9457 defines `type` as the primary identifier, defines `title`, `status`,
`detail`, and `instance`, permits problem-type-specific extension members, and
specifically warns consumers not to parse `detail`. It recommends a resolvable
HTTP(S) type URI when documentation is available, but also permits nonresolvable
identifiers. These requirements make Problem Details plus extensions a better
fit than a custom error envelope while preserving the accepted short domain
codes.
[RFC 9457 sections 3.1 and 3.2](https://www.rfc-editor.org/rfc/rfc9457.html#section-3)

Represent request validation as one problem with field-level extensions:

```json
{
  "type": "https://api.example.com/problems/validation-failed",
  "title": "Request validation failed",
  "status": 422,
  "code": "validation-failed",
  "errors": [
    {
      "pointer": "#/amount/value",
      "code": "invalid-money"
    }
  ]
}
```

`pointer` is a JSON Pointer into the request document. Each field-level `code`
is machine-readable; optional prose can be added for logs or generic clients,
but first-party clients map the code to their own localized UI. RFC 9457 itself
demonstrates an `errors` extension containing JSON Pointers for multiple
validation failures.
[RFC 9457 section 3 example](https://www.rfc-editor.org/rfc/rfc9457.html#name-examples)

Unexpected faults are deliberately opaque:

```json
{
  "type": "https://api.example.com/problems/internal-error",
  "title": "Internal server error",
  "status": 500,
  "code": "internal-error"
}
```

Do not send exception messages, SQL errors, stack traces, secrets, or internal
paths. The response's `X-Request-Id` is the support handle. Omit Problem
Details' optional `instance` unless the service has a meaningful occurrence URI
that a client can use; do not duplicate the bare request ID into the body.

## Status and header conventions

| Operation or outcome              | Status | Body                                      | Headers                                        |
| --------------------------------- | -----: | ----------------------------------------- | ---------------------------------------------- |
| Fetch one                         |    200 | Direct resource                           | `Content-Type: application/json`               |
| Fetch collection                  |    200 | `{ items, page: { nextCursor } }`         | `Content-Type: application/json`               |
| Create                            |    201 | Direct created resource                   | `Content-Type`, `Location`                     |
| Partial update                    |    200 | Direct updated resource                   | `Content-Type: application/json`               |
| Delete with no representation     |    204 | None                                      | No `Content-Type`                              |
| Malformed JSON or request syntax  |    400 | Problem Details                           | `Content-Type: application/problem+json`       |
| Missing or invalid authentication |    401 | Problem Details                           | Problem media type; auth headers when required |
| Authenticated but forbidden       |    403 | Problem Details                           | Problem media type                             |
| Resource not found                |    404 | Problem Details                           | Problem media type                             |
| State or uniqueness conflict      |    409 | Problem Details                           | Problem media type                             |
| Well-formed command is invalid    |    422 | Problem Details, optionally with `errors` | Problem media type                             |
| Rate limited                      |    429 | Problem Details                           | Problem media type; `Retry-After` when known   |
| Unexpected server fault           |    500 | Opaque Problem Details                    | Problem media type                             |
| Temporarily unavailable           |    503 | Opaque Problem Details                    | Problem media type; `Retry-After` when known   |

Every row also returns `X-Request-Id`. A protected resource may deliberately
use `404` instead of `403` when revealing its existence would disclose another
user's data; that is an authorization policy, not a response-shape exception.
RFC 9110 defines these status semantics and prohibits content in a `204`
response.
[RFC 9110 status codes](https://www.rfc-editor.org/rfc/rfc9110.html#name-status-codes),
[RFC 9110 section 15.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.5)

## Request IDs, CORS, and tracing

Generate a fresh, opaque `X-Request-Id` at the API boundary, attach it to the
request context, log it with all work for that request, and echo it as a
response header. Do not trust an arbitrary browser-supplied value as the
server's log identifier. If a trusted upstream proxy is introduced later, its
identifier can be retained separately or accepted under an explicit trust
policy.

Hono's request-ID middleware uses `X-Request-Id` by default, stores the value in
the request context, and adds it to the response. Its default behavior can
accept a valid inbound value, so the implementation must deliberately enforce
the server-generation policy rather than installing defaults without review.
[Hono request ID middleware](https://hono.dev/docs/middleware/builtin/request-id)

Because the SPA and API are cross-origin, browser JavaScript cannot read an
arbitrary response header unless CORS exposes it. Configure Hono with at least:

```ts
cors({
  // The concrete allowlist and credentials policy are configured elsewhere.
  exposeHeaders: ["X-Request-Id", "Location"],
});
```

Hono exposes this as the `exposeHeaders` option, matching Fetch's CORS-exposed
response-header rules. Exposing `Location` lets the SPA read the canonical URI
after creation.
[Hono CORS middleware](https://hono.dev/docs/middleware/builtin/cors),
[Fetch standard: CORS-exposed response headers](https://fetch.spec.whatwg.org/#cors-exposed-header-name-list)

The request ID is an application support and log-correlation handle, not an
idempotency key and not a replacement for distributed trace context. If
distributed tracing is added, propagate the standardized `traceparent` and
`tracestate` headers separately according to W3C Trace Context.
[W3C Trace Context](https://www.w3.org/TR/trace-context/)

## Contract ownership

Hono owns serialization, HTTP statuses, media types, CORS exposure, and mapping
core outcomes to stable problem types and codes. Core operations return typed
successes or typed domain failures without knowledge of HTTP. Response
presenters map core values, especially `bigint` money, into runtime-described
DTOs. The SPA and future Expo client consume those DTOs, branch on stable codes,
and own localized display.

This boundary keeps the wire contract explicit without requiring a generated
client or a JSON:API implementation. A generated client may later be derived
from the same runtime schemas, but its TypeScript types are not a substitute for
validating actual HTTP responses in contract tests.
