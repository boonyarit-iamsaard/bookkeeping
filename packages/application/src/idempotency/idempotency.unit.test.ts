import { describe, expect, test } from "vitest";
import { fingerprintValidatedPayload } from "./idempotency";

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
