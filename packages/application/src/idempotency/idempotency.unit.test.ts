import { describe, expect, test } from "vitest";
import {
  decodeStoredResult,
  encodeStoredResult,
  fingerprintValidatedPayload,
} from "./idempotency";

// The tags a receipt uses for the two values JSON cannot hold.
const BIGINT = "$bigint";
const DATE = "$date";

describe("stored creation results", () => {
  test("round-trips bigint and Date values inside nested objects and arrays", () => {
    const value = {
      id: "0199",
      amount: 12_345n,
      recordedAt: new Date("2026-09-20T01:02:03.456Z"),
      wallet: { archived: false, name: "Cash" },
      refunds: [{ amount: 1n, note: null }],
      remaining: 0,
    };

    const stored = encodeStoredResult(value);

    expect(JSON.parse(JSON.stringify(stored))).toEqual(stored);
    expect(stored).toEqual({
      id: "0199",
      amount: { [BIGINT]: "12345" },
      recordedAt: { [DATE]: "2026-09-20T01:02:03.456Z" },
      wallet: { archived: false, name: "Cash" },
      refunds: [{ amount: { [BIGINT]: "1" }, note: null }],
      remaining: 0,
    });
    expect(decodeStoredResult<typeof value>(stored)).toEqual(value);
  });

  test("drops undefined members like JSON does", () => {
    expect(encodeStoredResult({ id: "1", createdParent: undefined })).toEqual({
      id: "1",
    });
  });

  test("refuses values a receipt cannot hold", () => {
    expect(() => encodeStoredResult({ when: Number.NaN })).toThrow(TypeError);
    expect(() => encodeStoredResult({ run: () => 1 })).toThrow(TypeError);
    expect(() => encodeStoredResult({ set: new Set([1]) })).toThrow(TypeError);
  });
});

describe("fingerprintValidatedPayload", () => {
  test("object key order does not change a validated payload fingerprint", () => {
    const first = fingerprintValidatedPayload({
      amount: 12_345n,
      details: { note: "Lunch", tags: ["food", "weekday"] },
    });
    const reordered = fingerprintValidatedPayload({
      details: { tags: ["food", "weekday"], note: "Lunch" },
      amount: 12_345n,
    });

    expect(reordered).toBe(first);
  });

  test("different validated values have different fingerprints without scalar collisions", () => {
    const fingerprints = [
      fingerprintValidatedPayload({ value: 1 }),
      fingerprintValidatedPayload({ value: 1n }),
      fingerprintValidatedPayload({ value: "1" }),
      fingerprintValidatedPayload({ value: true }),
      fingerprintValidatedPayload({ value: ["1"] }),
    ];

    expect(new Set(fingerprints).size).toBe(fingerprints.length);
  });
});
