import { listWallets } from "@bookkeeping/application/wallets";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { describe, expect, test } from "vitest";
import { createWallet } from "@/features/wallets/server/wallet";

const { withRollback } = setupTestDatabase();

describe("createWallet", () => {
  test("a created wallet is listed with its opening balance as the balance", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);

      const created = await createWallet(db, {
        ownerId: owner.id,
        name: "Kasikorn savings",
        type: "bank_account",
        openingAmount: 1_200_000n,
        openingDate: "2026-09-01",
      });

      expect(created).toEqual(
        expect.objectContaining({
          name: "Kasikorn savings",
          type: "bank_account",
          currency: "THB",
          openingAmount: 1_200_000n,
          openingDate: "2026-09-01",
          balance: 1_200_000n,
        }),
      );
      expect(await listWallets(db, { ownerId: owner.id })).toEqual([created]);
    });
  });
});
