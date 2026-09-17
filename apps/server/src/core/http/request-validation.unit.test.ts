import { describe, expect, it } from "vitest";
import * as z from "zod";
import { moneyInputSchema } from "./money.js";
import { createInvalidCommandProblem } from "./request-validation.js";

const schema = z.object({
  name: z.string(),
  amount: moneyInputSchema,
  tags: z.array(z.string()),
  "a/b": z.string(),
});

describe("createInvalidCommandProblem", () => {
  it("addresses each issue with a JSON Pointer and a kebab-case code", () => {
    const result = schema.safeParse({
      name: 5,
      amount: { value: "1e3", currency: "USD" },
      tags: ["ok", 7],
      "a/b": "fine",
    });
    if (result.success) {
      throw new Error("Expected the command to be rejected");
    }

    expect(createInvalidCommandProblem(result.error.issues)).toEqual({
      code: "invalid-command",
      status: 422,
      title: "Command is invalid",
      errors: [
        { pointer: "#/name", code: "invalid-type" },
        { pointer: "#/amount/value", code: "invalid-format" },
        { pointer: "#/amount/currency", code: "invalid-value" },
        { pointer: "#/tags/1", code: "invalid-type" },
      ],
    });
  });

  it("escapes pointer segments and surfaces a custom issue's own code", () => {
    const result = z
      .object({
        "a/b": z.string().superRefine((_, ctx) => {
          ctx.addIssue({
            code: "custom",
            message: "nope",
            params: { code: "not-allowed" },
          });
        }),
        "c~d": z.string().superRefine((_, ctx) => {
          ctx.addIssue({ code: "custom", message: "no code" });
        }),
      })
      .safeParse({ "a/b": "x", "c~d": "y" });
    if (result.success) {
      throw new Error("Expected the command to be rejected");
    }

    expect(createInvalidCommandProblem(result.error.issues).errors).toEqual([
      { pointer: "#/a~1b", code: "not-allowed" },
      { pointer: "#/c~0d", code: "invalid" },
    ]);
  });
});
