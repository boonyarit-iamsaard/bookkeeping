import { describe, expect, test } from "vitest";
import {
  captureOriginHref,
  captureReturnHref,
  captureSearchForLocation,
  resolveCaptureOrigin,
} from "@/features/transactions/capture-origin";

describe("resolveCaptureOrigin", () => {
  test("keeps an internal path and its search", () => {
    expect(
      resolveCaptureOrigin("/transactions?walletId=wallet-1&type=expense"),
    ).toEqual({
      pathname: "/transactions",
      search: "?walletId=wallet-1&type=expense",
    });
  });

  test.each([
    undefined,
    "",
    "https://example.com/transactions",
    "//example.com/transactions",
    "/\\example.com/transactions",
  ])("resolves an unsafe or missing origin (%s) to Home", (origin) => {
    expect(resolveCaptureOrigin(origin)).toEqual({
      pathname: "/",
      search: "",
    });
  });

  test("builds a return link with the new id while keeping the origin search", () => {
    const origin = resolveCaptureOrigin(
      "/transactions?type=expense&created=older-id",
    );
    expect(captureOriginHref(origin)).toBe("/transactions?type=expense");
    expect(captureReturnHref(origin, "new-id")).toBe(
      "/transactions?type=expense&created=new-id",
    );
  });

  test("returns history to its newest page after save but preserves the cursor on cancel", () => {
    const transactionsOrigin = resolveCaptureOrigin(
      "/transactions?type=expense&cursor=older-page",
    );
    const walletOrigin = resolveCaptureOrigin(
      "/wallets/wallet-1?cursor=older-page",
    );

    expect(captureOriginHref(transactionsOrigin)).toBe(
      "/transactions?type=expense&cursor=older-page",
    );
    expect(captureReturnHref(transactionsOrigin, "new-id")).toBe(
      "/transactions?type=expense&created=new-id",
    );
    expect(captureReturnHref(walletOrigin, "new-id")).toBe(
      "/wallets/wallet-1?created=new-id",
    );
  });
});

describe("captureSearchForLocation", () => {
  test("includes the current path and search without a wallet filter as a wallet", () => {
    expect(
      captureSearchForLocation({
        pathname: "/transactions",
        searchStr: "?walletId=filtered-wallet",
      }),
    ).toEqual({
      origin: "/transactions?walletId=filtered-wallet",
    });
  });

  test("passes a wallet only from a wallet page", () => {
    expect(
      captureSearchForLocation({
        pathname: "/wallets/wallet-1",
        searchStr: "?cursor=next-page",
      }),
    ).toEqual({
      origin: "/wallets/wallet-1?cursor=next-page",
      wallet: "wallet-1",
    });
    expect(
      captureSearchForLocation({
        pathname: "/wallets/wallet-1/manage",
        searchStr: "",
      }),
    ).toEqual({ origin: "/wallets/wallet-1/manage" });
  });
});
