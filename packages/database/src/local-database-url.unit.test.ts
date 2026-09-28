import { describe, expect, test } from "vitest";
import { assertLocalDatabaseUrl } from "./local-database-url";

describe("assertLocalDatabaseUrl", () => {
  test.each([
    "postgresql://postgres:password@localhost:5432/bookkeeping",
    "postgresql://postgres:password@127.0.0.1:5432/bookkeeping",
  ])("accepts %s", (url) => {
    expect(() => assertLocalDatabaseUrl(url)).not.toThrow();
  });

  test.each([
    {
      description: "a Railway proxy host",
      url: "postgresql://postgres:password@postgres-production-1234.proxy.rlwy.net:5432/bookkeeping",
      host: "postgres-production-1234.proxy.rlwy.net",
    },
    {
      description: "a private-network host",
      url: "postgresql://postgres:password@postgres.internal:5432/bookkeeping",
      host: "postgres.internal",
    },
    {
      description: "a non-loopback IP address",
      url: "postgresql://postgres:password@192.168.1.42:5432/bookkeeping",
      host: "192.168.1.42",
    },
    {
      description: "a local URL whose host query parameter names a remote host",
      url: "postgresql://postgres:password@localhost:5432/bookkeeping?host=postgres-production-1234.proxy.rlwy.net",
      host: "postgres-production-1234.proxy.rlwy.net",
    },
    {
      description: "a URL without a host",
      url: "postgresql://postgres:password@/bookkeeping",
      host: "",
    },
  ])("refuses $description", ({ url, host }) => {
    expect(() => assertLocalDatabaseUrl(url)).toThrow(
      `Refusing to reset non-local database host "${host}"`,
    );
  });
});
