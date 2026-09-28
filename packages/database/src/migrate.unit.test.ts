import { describe, expect, test } from "vitest";
import { freshDatabase } from "./migrate";

describe("freshDatabase", () => {
  test("refuses a non-local database before connecting", async () => {
    const url =
      "postgresql://postgres:password@localhost:5432/bookkeeping?host=postgres-production-1234.proxy.rlwy.net";

    await expect(freshDatabase(url)).rejects.toThrow(
      'Refusing to reset non-local database host "postgres-production-1234.proxy.rlwy.net"',
    );
  });
});
