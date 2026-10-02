import { describe, expect, test } from "vitest";
import { parseAppearance, resolveScheme } from "./appearance";

describe("the stored appearance", () => {
  test("is System when nothing is stored", () => {
    expect(parseAppearance(null)).toBe("system");
  });

  test("is System when the stored value is unknown", () => {
    expect(parseAppearance("sepia")).toBe("system");
  });

  test("keeps a stored Dark", () => {
    expect(parseAppearance("dark")).toBe("dark");
  });
});

describe("the shown scheme", () => {
  test("follows a dark system under System", () => {
    expect(resolveScheme({ appearance: "system", systemDark: true })).toBe(
      "dark",
    );
  });

  test("follows a light system under System", () => {
    expect(resolveScheme({ appearance: "system", systemDark: false })).toBe(
      "light",
    );
  });

  test("is Light over a dark system when Light is chosen", () => {
    expect(resolveScheme({ appearance: "light", systemDark: true })).toBe(
      "light",
    );
  });

  test("is Dark over a light system when Dark is chosen", () => {
    expect(resolveScheme({ appearance: "dark", systemDark: false })).toBe(
      "dark",
    );
  });
});
