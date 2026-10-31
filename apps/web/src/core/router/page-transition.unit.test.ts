import { describe, expect, test } from "vitest";
import { pageTransitionTypes } from "@/core/router/page-transition";

function typesFor(fromPathname: string | undefined, toPathname: string) {
  return pageTransitionTypes({
    fromPathname,
    toPathname,
    reducedMotion: false,
    loading: false,
  });
}

describe("pageTransitionTypes", () => {
  test.each([
    ["/", "/transactions"],
    ["/transactions", "/reports"],
    ["/wallets", "/categories"],
    ["/transactions/transaction-1", "/transactions/transaction-2"],
    ["/sign-in", "/sign-up"],
    ["/sign-in", "/"],
  ])("crossfades between peers (%s to %s)", (from, to) => {
    expect(typesFor(from, to)).toEqual(["page-swap"]);
  });

  test.each([
    ["/transactions", "/transactions/transaction-1"],
    ["/", "/transactions/transaction-1"],
    ["/transactions/transaction-1", "/transactions/transaction-1/edit"],
    ["/wallets/wallet-1", "/wallets/wallet-1/manage"],
    ["/wallets", "/wallets/new"],
  ])("pushes going deeper (%s to %s)", (from, to) => {
    expect(typesFor(from, to)).toEqual(["page-push"]);
  });

  test.each([
    ["/transactions/transaction-1", "/transactions"],
    ["/transactions/transaction-1/refund", "/transactions/transaction-1"],
    ["/wallets/new", "/wallets"],
  ])("pops coming back (%s to %s)", (from, to) => {
    expect(typesFor(from, to)).toEqual(["page-pop"]);
  });

  test("morphs the wallet card into its page's hero and back", () => {
    expect(typesFor("/wallets", "/wallets/wallet-1")).toEqual([
      "page-push",
      "morph",
    ]);
    expect(typesFor("/wallets/wallet-1", "/wallets")).toEqual([
      "page-pop",
      "morph",
    ]);
  });

  test("raises capture from any screen and lowers it on leaving", () => {
    expect(typesFor("/", "/transactions/new")).toEqual(["page-rise"]);
    expect(typesFor("/wallets/wallet-1", "/transactions/new")).toEqual([
      "page-rise",
    ]);
    expect(typesFor("/transactions/new", "/")).toEqual(["page-fall"]);
  });

  test.each([
    [undefined, "/"],
    ["/transactions", "/transactions"],
    ["/transactions/", "/transactions"],
  ])(
    "moves nothing on first load or a search-only change (%s to %s)",
    (from, to) => {
      expect(typesFor(from, to)).toBe(false);
    },
  );

  test("moves nothing under reduced motion", () => {
    expect(
      pageTransitionTypes({
        fromPathname: "/transactions",
        toPathname: "/transactions/transaction-1",
        reducedMotion: true,
        loading: false,
      }),
    ).toBe(false);
  });

  test("crossfades over a loading skeleton whatever the direction", () => {
    expect(
      pageTransitionTypes({
        fromPathname: "/transactions",
        toPathname: "/transactions/transaction-1",
        reducedMotion: false,
        loading: true,
      }),
    ).toEqual(["page-load"]);
  });
});
