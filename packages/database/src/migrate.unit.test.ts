import { describe, expect, test } from "vitest";
import { freshDatabase } from "./migrate";

describe("freshDatabase", () => {
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
  ])("refuses $description before connecting", async ({ url, host }) => {
    await expect(freshDatabase(url)).rejects.toThrow(
      `Refusing to reset non-local database host "${host}"`,
    );
  });
});
