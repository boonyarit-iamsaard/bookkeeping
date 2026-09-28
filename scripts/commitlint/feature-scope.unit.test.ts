import { describe, expect, it } from "vitest";
import { checkFeatureScope, findFeatureScopes } from "./feature-scope";

describe("findFeatureScopes", () => {
  it("maps app feature and package directories to their feature", () => {
    expect(
      findFeatureScopes([
        "apps/web/src/features/wallets/wallet-list.tsx",
        "packages/database/src/wallets/wallet.schema.ts",
        "packages/domain/src/wallets/wallet.types.ts",
      ]),
    ).toEqual(["wallets"]);
  });

  it("maps auth and sign-up directories to accounts", () => {
    expect(
      findFeatureScopes([
        "apps/web/src/features/auth/sign-in-form.tsx",
        "apps/server/src/features/sign-up/sign-up.routes.ts",
      ]),
    ).toEqual(["accounts"]);
  });

  it("ignores non-feature directories and root files", () => {
    expect(
      findFeatureScopes([
        "apps/web/src/shared/components/button.tsx",
        "apps/web/src/features/home/home-page.tsx",
        "packages/domain/src/money/money.ts",
        "packages/database/drizzle/0001_create_wallets_table.sql",
        ".scratch/wallets/issues/01-wallets.md",
        "package.json",
      ]),
    ).toEqual([]);
  });

  it("lists several touched features once each, sorted", () => {
    expect(
      findFeatureScopes([
        "apps/server/src/features/wallets/wallet.routes.ts",
        "packages/application/src/categories/category.ts",
        "apps/web/src/features/wallets/wallet-page.tsx",
      ]),
    ).toEqual(["categories", "wallets"]);
  });
});

describe("checkFeatureScope", () => {
  const walletPaths = [
    "apps/web/src/features/wallets/wallet-page.tsx",
    "apps/web/src/shared/components/button.tsx",
  ];

  it("requires the scope of the one touched feature", () => {
    expect(
      checkFeatureScope({ scope: "wallets", stagedPaths: walletPaths }),
    ).toEqual([true]);
    expect(
      checkFeatureScope({ scope: null, stagedPaths: walletPaths }),
    ).toEqual([
      false,
      'scope must be "wallets" because the staged changes touch only the wallets feature',
    ]);
    expect(
      checkFeatureScope({ scope: "categories", stagedPaths: walletPaths })[0],
    ).toBe(false);
  });

  it("forbids a scope when no feature is touched", () => {
    const stagedPaths = ["package.json"];

    expect(checkFeatureScope({ scope: null, stagedPaths })).toEqual([true]);
    expect(checkFeatureScope({ scope: "wallets", stagedPaths })).toEqual([
      false,
      "scope must be empty because the staged changes touch no domain feature",
    ]);
  });

  it("forbids a scope when several features are touched", () => {
    const stagedPaths = [
      "packages/domain/src/wallets/wallet.types.ts",
      "packages/domain/src/transactions/transaction.types.ts",
    ];

    expect(checkFeatureScope({ scope: null, stagedPaths })).toEqual([true]);
    expect(checkFeatureScope({ scope: "wallets", stagedPaths })).toEqual([
      false,
      "scope must be empty because the staged changes touch several domain features (transactions, wallets)",
    ]);
  });

  it("does not judge a commit that stages nothing", () => {
    expect(checkFeatureScope({ scope: "wallets", stagedPaths: [] })).toEqual([
      true,
    ]);
    expect(checkFeatureScope({ scope: null, stagedPaths: [] })).toEqual([true]);
  });
});
