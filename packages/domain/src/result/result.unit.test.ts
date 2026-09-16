import { describe, expect, test } from "vitest";
import { err, ok } from "./result";

describe("Result", () => {
  test("ok wraps a value", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  test("err wraps an error", () => {
    expect(err("invalid")).toEqual({ ok: false, error: "invalid" });
  });
});
