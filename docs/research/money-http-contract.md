# Money representation at the HTTP boundary

Researched 2026-09-16. Scope: the planned Hono API contract for command input,
server validation and mapping, internal operations, and responses to a TypeScript
web client or possible future Expo client.

## Recommendation

Use a semantic money object with an exact **major-unit decimal string** on both
requests and responses:

```json
{
  "amount": {
    "value": "125.50",
    "currency": "THB"
  }
}
```

`value` is a base-10 amount in the currency's major unit, not a formatted label.
For THB, responses always use exactly two fractional digits. Requests may use
zero, one, or two fractional digits (`"125"`, `"125.5"`, or `"125.50"`), which
the server normalizes to `"125.50"` when presenting a response.

At the Hono boundary, validate the runtime shape and decimal grammar, then parse
directly to integer minor units without passing through a JavaScript `number`:

```text
HTTP command                 validated core command       HTTP response
{ value: "125.50",          { amount: 12550n,            { value: "125.50",
  currency: "THB" }    ->     currency: "THB" }     ->     currency: "THB" }
```

The server is authoritative for parsing, currency support, sign and range
checks, conversion to satang, and all financial operations. A client may repeat
checks for immediate form feedback, but a successful client-side check has no
authority. The client owns locale-sensitive display; the canonical API value is
never only a string such as `"฿125.50"`.

This deliberately differs from the earlier candidate of returning a minor-unit
decimal string. That candidate is exact, but it makes every client know that THB
has 100 minor units per baht and implement the conversion. A decimal major-unit
string better matches the requested thin-client boundary while preserving exact
interchange.

## Why JSON numbers are not the contract

The repo stores wallet openings and transaction amounts as PostgreSQL `bigint`
and maps them to JavaScript `bigint` with Drizzle
([wallet schema](../../apps/web/src/core/database/schema/wallets.ts),
[transaction schema](../../apps/web/src/core/database/schema/transactions.ts)).
Its parser permits 15 whole baht digits, so a wallet opening can reach
`99,999,999,999,999,999` satang
([money helper](../../packages/domain/src/money/money.ts)). That exceeds
JavaScript's maximum safe integer, `9,007,199,254,740,991`. ECMAScript explains
that larger integers can collapse to the same `Number` value, and RFC 8259 only
guarantees exact agreement for JSON integers through 2^53−1.
[ECMAScript `Number.MAX_SAFE_INTEGER`](https://tc39.es/ecma262/#sec-number.max_safe_integer),
[RFC 8259 section 6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6)

The transaction maximum of `9,999,999,999` satang happens to fit safely, but
using JSON numbers only for transactions would create two money conventions.
Wallet balances and monthly totals are derived by summing transactions and can
be larger. PostgreSQL returns `sum(bigint)` as `numeric`, which is why the
current queries receive aggregate values as decimal strings before constructing
internal `bigint` values.
[PostgreSQL aggregate functions](https://www.postgresql.org/docs/current/functions-aggregate.html),
[wallet balance query](../../apps/web/src/features/wallets/server/wallet.ts),
[monthly summary query](../../apps/web/src/features/transactions/server/history.ts)

PostgreSQL `bigint` itself is an exact signed 64-bit integer with range
−9,223,372,036,854,775,808 through 9,223,372,036,854,775,807, so the repo's
largest permitted wallet opening fits. Drizzle documents `mode: "number"` for
values below 2^53 and `mode: "bigint"` for JavaScript `bigint`, matching the
current schema choice.
[PostgreSQL numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html),
[Drizzle PostgreSQL `bigint`](https://orm.drizzle.team/docs/column-types#bigint)

Native `bigint` is not a JSON value: ECMAScript's `JSON.stringify` throws when
it encounters one unless custom handling intervenes. The API therefore needs
explicit response presenters; a global serializer or implicit cast would make
the wire contract easier to change accidentally.
[ECMAScript `JSON.stringify`](https://tc39.es/ecma262/#sec-json.stringify)

## Comparison of the candidate representations

| Representation                        | Exact for this repo                                      | Thin-client fit                                                           | Decision                               |
| ------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------- |
| Major-unit decimal string, `"125.50"` | Yes, with strict decimal parsing                         | Client neither converts satang nor knows currency scale                   | Use for commands and responses         |
| Minor-unit JSON number, `12550`       | Not for the wallet range or all derived balances         | Convenient until a value exceeds 2^53−1                                   | Reject as the common contract          |
| Minor-unit decimal string, `"12550"`  | Yes                                                      | Every client must know scale and convert for input/display                | Exact fallback, but not preferred here |
| Preformatted value, `"฿125.50"`       | It can preserve digits, but mixes data with presentation | Easy to display; poor for editing, calculation, export, or another locale | Never use as the sole value            |

There is no single universal industry representation. Stripe expects integer
minor units and caps ordinary PaymentIntent amounts to eight digits; Square's
Money object specifies a signed 64-bit integer in the smallest denomination.
PayPal instead models a money value as a decimal string paired with a currency
code. The first two establish that integer minor units are common, but their
JSON-number shape does not solve this repo's larger JavaScript values. PayPal's
shape is the closer precedent for an exact, client-neutral decimal contract.
[Stripe currencies](https://docs.stripe.com/currencies),
[Square Money](https://developer.squareup.com/reference/square/objects/Money),
[PayPal Orders money definition](https://developer.paypal.com/sdk/orders/v2/definitions/order/)

## Exact request and response shapes

Create or correct a wallet using the domain field name and a Money input:

```json
{
  "name": "Cash",
  "type": "cash",
  "openingAmount": {
    "value": "-12000.50",
    "currency": "THB"
  },
  "openingDate": "2026-09-16"
}
```

Create or update a transaction in the same form:

```json
{
  "type": "expense",
  "walletId": "0199...",
  "amount": {
    "value": "125.50",
    "currency": "THB"
  },
  "transactionDate": "2026-09-16"
}
```

Use the same Money response DTO wherever an amount appears, including nested
refund limits and expected-error details:

```json
{
  "id": "0199...",
  "openingAmount": { "value": "-12000.50", "currency": "THB" },
  "balance": { "value": "-12126.00", "currency": "THB" }
}
```

This avoids ambiguous field names such as `amountMinor` while keeping the unit
inside the value object. It also avoids separate wire types for openings,
transactions, balances, and aggregates.

## Validation and mapping ownership

The request schema should accept a JSON object only when:

- `currency` is exactly `"THB"` while THB is the only supported currency;
- `value` uses plain ASCII base-10 notation, with no exponent or currency
  symbol, and no more than two fractional digits;
- transaction amounts are positive and between `"0.01"` and
  `"99999999.99"` inclusive;
- wallet opening amounts permit zero and a leading minus and contain at most
  15 whole digits, preserving the current limit;
- grouping separators are not part of the HTTP contract. If the UI continues
  accepting `"1,234.50"`, that is input presentation and it normalizes to
  `"1234.50"` before making the request.

Hono supports validation of parsed JSON and returning the validated value to
the handler, including through Zod middleware. Zod supports string checks and
transforms, so the edge schema can produce the internal `bigint` command value.
The conversion must split whole and fractional digits, pad the fraction, and
construct `BigInt`; it must never use `parseFloat`, `Number`, or multiplication
in floating point.
[Hono validation](https://hono.dev/docs/guides/validation),
[Zod strings and transforms](https://zod.dev/api)

The layers should own these responsibilities:

1. **Hono request schema:** shape, supported currency, decimal grammar, and
   transport-level bounds; map the decimal string to satang.
2. **Core operation:** receive `bigint` satang, derive the authenticated owner,
   and enforce operation invariants such as transaction range, refund ceiling,
   and valid sign. Do not make correctness depend only on the HTTP adapter.
3. **Database:** retain exact integer storage and constraints as the final
   integrity boundary.
4. **HTTP presenter:** explicitly map every internal `bigint` to a fixed-scale
   decimal string and every internal date/time to its documented wire form.
5. **Client:** submit semantic decimal text, render locale-sensitive labels,
   and treat any local validation as a UX optimization only. Balances, totals,
   sorting, refund availability, and other financial results come from the
   server.

Response schemas should be runtime-checked in tests so a newly added `bigint`
cannot reach Hono's JSON serializer accidentally. Hono's validation model and
OpenAPI integrations allow request and response schemas to remain the ordinary
HTTP contract rather than relying only on imported RPC types.
[Hono OpenAPI example](https://hono.dev/examples/hono-openapi)

## Effect on the current code

The existing `parseMoneyInput` already performs exact string-to-`bigint`
conversion, and internal wallet and transaction operations already use
`bigint`. Extraction should separate two concerns that currently live near the
Next.js forms:

- a client-agnostic Money request schema and exact decimal/satang mapper shared
  by the Hono edge and its contract tests;
- presentation helpers for localized labels and editable form text, owned by
  the client.

The API should not reuse the current preformatted `amountLabel` and
`remainingLabel` view fields as its canonical financial values. They can be
reconstructed by the web client from the semantic Money DTO, while the server
continues to own every financial calculation.
