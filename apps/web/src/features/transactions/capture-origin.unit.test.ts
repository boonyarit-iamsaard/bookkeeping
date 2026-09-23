import { describe, expect, test } from "vitest";
import {
  captureOriginHref,
  captureReturnHref,
  captureSearchForLocation,
  parseCaptureOrigin,
} from "@/features/transactions/capture-origin";

const APP_PATHNAMES = new Set([
  "/",
  "/transactions",
  "/transactions/new",
  "/wallets/new",
  "/wallets/wallet-1",
]);

function isSignedInPathname(pathname: string): boolean {
  return APP_PATHNAMES.has(pathname);
}

describe("parseCaptureOrigin", () => {
  test("keeps an internal path and its search", () => {
    expect(
      parseCaptureOrigin(
        "/transactions?walletId=wallet-1&type=expense",
        isSignedInPathname,
      ),
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
    expect(parseCaptureOrigin(origin, isSignedInPathname)).toEqual({
      pathname: "/",
      search: "",
    });
  });

  test("resolves a path with no screen of its own to Home", () => {
    expect(
      parseCaptureOrigin("/nope?type=expense", isSignedInPathname),
    ).toEqual({
      pathname: "/",
      search: "",
    });
  });

  test.each([
    "/transactions/new?origin=%2Ftransactions",
    "/transactions/new/?origin=%2Ftransactions",
    "/Transactions/New?origin=%2Ftransactions",
  ])("never returns to capture itself (%s)", (origin) => {
    expect(parseCaptureOrigin(origin, () => true)).toEqual({
      pathname: "/",
      search: "",
    });
  });

  test("builds a return link with the new id while keeping the origin search", () => {
    const origin = parseCaptureOrigin(
      "/transactions?type=expense&created=older-id",
      isSignedInPathname,
    );
    expect(captureOriginHref(origin)).toBe("/transactions?type=expense");
    expect(captureReturnHref(origin, "new-id")).toBe(
      "/transactions?type=expense&created=new-id",
    );
  });

  test("returns history to its newest page after save but preserves the cursor on cancel", () => {
    const transactionsOrigin = parseCaptureOrigin(
      "/transactions?type=expense&cursor=older-page",
      isSignedInPathname,
    );
    const walletOrigin = parseCaptureOrigin(
      "/wallets/wallet-1?cursor=older-page",
      isSignedInPathname,
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

  test("does not treat the new-wallet screen as wallet history", () => {
    const origin = parseCaptureOrigin(
      "/wallets/new?cursor=older-page",
      isSignedInPathname,
    );
    expect(captureReturnHref(origin, "new-id")).toBe(
      "/wallets/new?cursor=older-page&created=new-id",
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
    expect(
      captureSearchForLocation({ pathname: "/wallets/new", searchStr: "" }),
    ).toEqual({ origin: "/wallets/new" });
  });

  test.each(["/transactions/new", "/transactions/new/"])(
    "keeps capture's own origin and wallet when opened from %s",
    (pathname) => {
      expect(
        captureSearchForLocation({
          pathname,
          searchStr:
            "?origin=%2Fwallets%2Fwallet-1%3Fcursor%3Dolder-page&wallet=wallet-1",
        }),
      ).toEqual({
        origin: "/wallets/wallet-1?cursor=older-page",
        wallet: "wallet-1",
      });
    },
  );

  test("falls back to Home when capture was opened without an origin", () => {
    expect(
      captureSearchForLocation({
        pathname: "/transactions/new",
        searchStr: "",
      }),
    ).toEqual({ origin: "/" });
  });

  test("leaves checking capture's own origin to the capture screen", () => {
    expect(
      captureSearchForLocation({
        pathname: "/transactions/new",
        searchStr: "?origin=%2Fnope",
      }),
    ).toEqual({ origin: "/nope" });
  });
});
