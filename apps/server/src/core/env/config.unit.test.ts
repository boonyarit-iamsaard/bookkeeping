import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./config.js";

const requiredEnv = {
  BETTER_AUTH_SECRET: "server-owned-secret-that-is-at-least-32-chars",
  BETTER_AUTH_URL: "http://localhost:5000",
  CLIENT_ORIGINS: "http://localhost:4000",
  DATABASE_URL: "postgresql://postgres:password@localhost:5432/bookkeeping",
};

describe("server env config", () => {
  it("applies listener defaults when optional values are absent", () => {
    expect(parseServerEnv(requiredEnv)).toEqual({
      port: 5000,
      hostname: "0.0.0.0",
      databaseUrl: requiredEnv.DATABASE_URL,
      authSecret: requiredEnv.BETTER_AUTH_SECRET,
      authBaseUrl: "http://localhost:5000",
      clientOrigins: ["http://localhost:4000"],
      authRateLimitEnabled: undefined,
    });
  });

  it("reads an explicit authentication rate limit switch", () => {
    expect(
      parseServerEnv({ ...requiredEnv, AUTH_RATE_LIMIT: "off" })
        .authRateLimitEnabled,
    ).toBe(false);
    expect(
      parseServerEnv({ ...requiredEnv, AUTH_RATE_LIMIT: "on" })
        .authRateLimitEnabled,
    ).toBe(true);
    expect(() =>
      parseServerEnv({ ...requiredEnv, AUTH_RATE_LIMIT: "false" }),
    ).toThrow();
  });

  it("reads listener overrides from the environment source", () => {
    expect(
      parseServerEnv({ ...requiredEnv, PORT: "8080", HOST: "127.0.0.1" }),
    ).toMatchObject({ port: 8080, hostname: "127.0.0.1" });
  });

  it("splits client origins on commas and keeps only their origin", () => {
    expect(
      parseServerEnv({
        ...requiredEnv,
        CLIENT_ORIGINS:
          " http://localhost:4000/ ,https://app.example.com/dashboard",
      }).clientOrigins,
    ).toEqual(["http://localhost:4000", "https://app.example.com"]);
  });

  it("rejects a port that is not a positive integer", () => {
    expect(() =>
      parseServerEnv({ ...requiredEnv, PORT: "not-a-port" }),
    ).toThrow();
    expect(() => parseServerEnv({ ...requiredEnv, PORT: "0" })).toThrow();
    expect(() => parseServerEnv({ ...requiredEnv, PORT: "8080.5" })).toThrow();
  });

  it("rejects missing or weak authentication configuration", () => {
    expect(() =>
      parseServerEnv({ ...requiredEnv, BETTER_AUTH_SECRET: "short" }),
    ).toThrow();
    expect(() =>
      parseServerEnv({ ...requiredEnv, BETTER_AUTH_URL: "not-a-url" }),
    ).toThrow();
    expect(() =>
      parseServerEnv({ ...requiredEnv, CLIENT_ORIGINS: "" }),
    ).toThrow();
    expect(() =>
      parseServerEnv({ ...requiredEnv, CLIENT_ORIGINS: "localhost:4000" }),
    ).toThrow();
    expect(() =>
      parseServerEnv({ ...requiredEnv, DATABASE_URL: undefined }),
    ).toThrow();
  });
});
