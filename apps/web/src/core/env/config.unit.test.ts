import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { describe, expect, test } from "vitest";
import { parseClientEnv } from "./config";

describe("parseClientEnv", () => {
  test("reads the API origin", () => {
    expect(
      parseClientEnv({ VITE_API_ORIGIN: "http://localhost:5000" }),
    ).toEqual({
      apiOrigin: "http://localhost:5000",
    });
  });

  test("normalizes the API origin to its origin only", () => {
    expect(
      parseClientEnv({ VITE_API_ORIGIN: "https://api.example.com/v1/" })
        .apiOrigin,
    ).toBe("https://api.example.com");
  });

  test("rejects a missing or non-HTTP origin", () => {
    expect(() => parseClientEnv({})).toThrow();
    expect(() => parseClientEnv({ VITE_API_ORIGIN: "ftp://x" })).toThrow();
    expect(() =>
      parseClientEnv({ VITE_API_ORIGIN: "localhost:5000" }),
    ).toThrow();
  });

  test("accepts the documented example environment", () => {
    const example = readFileSync(
      new URL("../../../.env.example", import.meta.url),
      "utf8",
    );
    expect(() => parseClientEnv(parseEnv(example))).not.toThrow();
  });
});
