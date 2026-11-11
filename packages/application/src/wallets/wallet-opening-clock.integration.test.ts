import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { expect, test } from "vitest";
import { rejected } from "../shared/rejection";
import { withClock } from "../testing/transaction-suite-fixture";
import { createWalletForTest } from "../testing/wallet-fixture";
import { createWallet, replaceWalletOpening } from "./wallet";

const { withRollback } = setupTestDatabase();

test("Bangkok midnight accepts today's opening and refuses tomorrow's", async () => {
  await withRollback(async (db) => {
    const owner = await createTestUser(db);
    const wallet = await createWalletForTest(db, { ownerId: owner.id });
    function createOn(openingDate: string) {
      return createWallet(db, {
        ownerId: owner.id,
        idempotencyKey: `opening-${openingDate}`,
        name: "Cash",
        type: "cash",
        savings: false,
        openingAmount: 100n,
        openingDate,
      });
    }
    function replaceOn(openingDate: string) {
      return replaceWalletOpening(db, {
        ownerId: owner.id,
        id: wallet.id,
        openingAmount: 100n,
        openingDate,
      });
    }
    // 18:00 UTC on 14 Sep is already 01:00 on 15 Sep in Bangkok.
    await withClock("2026-09-14T18:00:00Z", async () => {
      expect(await createOn("2026-09-15")).toEqual({
        ok: true,
        value: expect.objectContaining({ openingDate: "2026-09-15" }),
      });
      expect(await createOn("2026-09-16")).toEqual({
        ok: false,
        error: rejected({ code: "in-future", field: "openingDate" }),
      });
      expect(await replaceOn("2026-09-15")).toEqual({
        ok: true,
        value: expect.objectContaining({ openingDate: "2026-09-15" }),
      });
      expect(await replaceOn("2026-09-16")).toEqual({
        ok: false,
        error: rejected({ code: "in-future", field: "openingDate" }),
      });
    });
  });
});
