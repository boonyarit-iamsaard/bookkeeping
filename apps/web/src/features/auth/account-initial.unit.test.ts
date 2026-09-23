import { describe, expect, test } from "vitest";
import { accountInitial } from "./account-initial";

describe("account initial", () => {
  test("is the email's first letter, uppercased", () => {
    expect(accountInitial("boon@example.com")).toBe("B");
  });

  test("ignores surrounding whitespace", () => {
    expect(accountInitial("  ada@example.com")).toBe("A");
  });

  test("falls back to a question mark for an empty email", () => {
    expect(accountInitial("   ")).toBe("?");
  });
});
