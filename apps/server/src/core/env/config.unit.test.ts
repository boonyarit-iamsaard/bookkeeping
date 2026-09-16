import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./config.js";

describe("server env config", () => {
  it("applies defaults when optional values are absent", () => {
    expect(parseServerEnv({})).toEqual({ port: 3001, hostname: "0.0.0.0" });
  });

  it("reads overrides from the environment source", () => {
    expect(parseServerEnv({ PORT: "8080", HOST: "127.0.0.1" })).toEqual({
      port: 8080,
      hostname: "127.0.0.1",
    });
  });

  it("rejects a port that is not a positive integer", () => {
    expect(() => parseServerEnv({ PORT: "not-a-port" })).toThrow();
    expect(() => parseServerEnv({ PORT: "0" })).toThrow();
    expect(() => parseServerEnv({ PORT: "8080.5" })).toThrow();
  });
});
