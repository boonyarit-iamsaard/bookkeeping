import { describe, expect, test } from "vitest";
import { historySearchSchema } from "./history-schema";

const WALLET_ID = "00000000-0000-4000-8000-000000000001";
const COFFEE = "00000000-0000-4000-8000-000000000003";
const SNACKS = "00000000-0000-4000-8000-000000000004";

describe("history search", () => {
  test("keeps text values and drops empty controls", () => {
    expect(
      historySearchSchema.parse({
        from: "2026-09-01",
        to: "",
        walletId: WALLET_ID,
        categoryId: undefined,
        cursor: "eyJ2IjoxfQ",
        created: "",
        unrelated: "x",
      }),
    ).toEqual({
      from: "2026-09-01",
      walletId: WALLET_ID,
      cursor: "eyJ2IjoxfQ",
    });
  });

  test("keeps the text of a value the router read as a number", () => {
    expect(historySearchSchema.parse({ type: 7 })).toEqual({ type: "7" });
  });

  test("reads the deletion flag as the number the address carries", () => {
    expect(historySearchSchema.parse({ deleted: 1 })).toEqual({ deleted: 1 });
    expect(historySearchSchema.parse({ deleted: "1" })).toEqual({
      deleted: 1,
    });
    expect(historySearchSchema.parse({ deleted: "yes" })).toEqual({});
  });

  test("reads one tag or several from the address as a list", () => {
    expect(historySearchSchema.parse({ tagId: COFFEE }).tagId).toEqual([
      COFFEE,
    ]);
    expect(
      historySearchSchema.parse({ tagId: [COFFEE, "", SNACKS] }).tagId,
    ).toEqual([COFFEE, SNACKS]);
    expect(historySearchSchema.parse({ tagId: [] }).tagId).toBeUndefined();
  });
});
