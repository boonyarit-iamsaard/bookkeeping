import { describe, expect, test } from "vitest";
import { assertLocalDatabaseHost } from "./migrate";

describe("assertLocalDatabaseHost", () => {
  test.each(["localhost", "127.0.0.1"])("accepts %s", (host) => {
    expect(() => assertLocalDatabaseHost(host)).not.toThrow();
  });

  test.each([
    ["a Railway proxy host", "postgres-production-1234.proxy.rlwy.net"],
    ["a private-network host", "postgres.internal"],
    ["a non-loopback IP address", "192.168.1.42"],
  ])("refuses %s", (_description, host) => {
    expect(() => assertLocalDatabaseHost(host)).toThrow(host);
  });
});
