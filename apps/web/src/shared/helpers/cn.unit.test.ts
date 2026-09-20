import { describe, expect, test } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  test("joins class names and drops falsy entries", () => {
    expect(cn("px-4", undefined, false, "py-2")).toBe("px-4 py-2");
  });
});
