import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import { createAppRouter, isSignedInPathname } from "@/core/router/router";

describe("isSignedInPathname", () => {
  const router = createAppRouter({ queryClient: new QueryClient() });

  test.each([
    "/",
    "/transactions",
    "/transactions/",
    "/wallets/wallet-1",
    "/wallets/wallet-1/manage",
    "/wallets",
    "/categories",
    "/dashboard",
    "/transactions/transaction-1",
    "/transactions/transaction-1/edit",
  ])("accepts a signed-in screen (%s)", (pathname) => {
    expect(isSignedInPathname(router, pathname)).toBe(true);
  });

  test.each(["/nope", "/wallets/wallet-1/nope/deeper", "/sign-in", "/sign-up"])(
    "rejects a path with no signed-in screen of its own (%s)",
    (pathname) => {
      expect(isSignedInPathname(router, pathname)).toBe(false);
    },
  );
});
