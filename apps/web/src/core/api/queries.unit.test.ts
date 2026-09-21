import { describe, expect, test } from "vitest";
import { paths } from "./openapi.json";
import {
  categoryQueries,
  reportQueries,
  transactionQueries,
  walletQueries,
} from "./queries";

/** One invocation per factory; the key's head names the documented path. */
const factoryInvocations = [
  walletQueries.list(),
  walletQueries.detail("w1"),
  categoryQueries.list(),
  categoryQueries.usage(),
  categoryQueries.detail("c1"),
  categoryQueries.detailUsage("c1"),
  transactionQueries.list(),
  transactionQueries.entryDefaults(),
  transactionQueries.detail("t1"),
  transactionQueries.refunds("t1"),
  reportQueries.monthly("2026-09"),
];

function documentedReadPaths(): string[] {
  return Object.entries(paths)
    .filter(([path, methods]) => path.startsWith("/v1/") && "get" in methods)
    .map(([path]) => path)
    .sort();
}

describe("read query factories", () => {
  test("cover every GET under /v1 in the committed document, and nothing else", () => {
    const factoryPaths = factoryInvocations
      .map((options) => options.queryKey[0])
      .sort();
    expect(factoryPaths).toEqual(documentedReadPaths());
  });

  test("are all exercised above, so a new factory must name its path", () => {
    const factoryCount = [
      walletQueries,
      categoryQueries,
      transactionQueries,
      reportQueries,
    ].reduce((count, group) => count + Object.keys(group).length, 0);
    expect(factoryInvocations).toHaveLength(factoryCount);
  });

  test("key each read by its path and parameters", () => {
    expect(walletQueries.list({ asOf: "2026-09-21" }).queryKey).toEqual([
      "/v1/wallets",
      { query: { asOf: "2026-09-21" } },
    ]);
    expect(walletQueries.detail("w1").queryKey).toEqual([
      "/v1/wallets/{walletId}",
      { path: { walletId: "w1" } },
    ]);
    expect(walletQueries.list().queryKey).toEqual(["/v1/wallets", {}]);
  });
});
