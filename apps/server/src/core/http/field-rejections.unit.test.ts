import { rejected } from "@bookkeeping/application/shared/rejection";
import { describe, expect, test } from "vitest";
import { defineCodeTable, toFieldErrors } from "./field-rejections.js";
import { moneySchema, presentMoney } from "./money.js";

type SampleRejection =
  | { code: "blank"; field: "label" }
  | { code: "too-large"; field: "amount"; limit: bigint };

const SAMPLE_POINTERS = { label: "#/label", amount: "#/amount/value" };

const sample = defineCodeTable<SampleRejection>("Sample", {
  blank: "plain",
  "too-large": {
    facts: { limit: moneySchema },
    project: ({ limit }) => ({
      limit: presentMoney({ amountInMinorUnits: limit, currency: "THB" }),
    }),
  },
});

describe("toFieldErrors", () => {
  test("answers one field error per rejection, in order, at the field's pointer", () => {
    const refused = rejected<SampleRejection>(
      { code: "too-large", field: "amount", limit: 10_000n },
      { code: "blank", field: "label" },
    );

    expect(
      toFieldErrors(refused, { pointers: SAMPLE_POINTERS, codes: sample }),
    ).toEqual([
      {
        pointer: "#/amount/value",
        code: "too-large",
        limit: { value: "100.00", currency: "THB" },
      },
      { pointer: "#/label", code: "blank" },
    ]);
  });
});

describe("the published field error", () => {
  test("accepts every projected rejection", () => {
    const projected = toFieldErrors(
      rejected<SampleRejection>(
        { code: "too-large", field: "amount", limit: 10_000n },
        { code: "blank", field: "label" },
      ),
      { pointers: SAMPLE_POINTERS, codes: sample },
    );

    for (const fieldError of projected) {
      expect(sample.fieldErrorSchema.safeParse(fieldError).success).toBe(true);
    }
  });

  test("refuses a rule code that lacks the facts its message names", () => {
    expect(
      sample.fieldErrorSchema.safeParse({
        pointer: "#/amount/value",
        code: "too-large",
      }).success,
    ).toBe(false);
  });

  test("keeps a request-validation code a plain string beside the rule codes", () => {
    const validation = { pointer: "#/label", code: "invalid_type" };

    expect(sample.fieldErrorSchema.safeParse(validation).success).toBe(true);
    expect(sample.ruleFieldErrorSchema.safeParse(validation).success).toBe(
      false,
    );
  });
});
