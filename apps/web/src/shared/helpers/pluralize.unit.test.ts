import { describe, expect, test } from "vitest";
import { pluralize } from "./pluralize";

describe("pluralize", () => {
  test("keeps the singular for one", () => {
    expect(pluralize(1, "wallet")).toBe("1 wallet");
  });

  test("adds an s for zero and many", () => {
    expect(pluralize(0, "wallet")).toBe("0 wallets");
    expect(pluralize(3, "wallet")).toBe("3 wallets");
  });

  test("takes an irregular plural", () => {
    expect(pluralize(2, ["category", "categories"])).toBe("2 categories");
  });
});
