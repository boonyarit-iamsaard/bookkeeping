import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { describe, expect, test } from "vitest";
import { insertTransaction } from "../testing/transaction-fixture";
import type { OwnerFixture } from "../testing/transaction-suite-fixture";
import { setupOwner } from "../testing/transaction-suite-fixture";
import type { ListNumberedTransactionPageOptions } from "./transaction-reads";
import { listNumberedTransactionPage } from "./transaction-reads";

const { withRollback } = setupTestDatabase();

type PageQuery = Omit<ListNumberedTransactionPageOptions, "ownerId">;

const NEWEST_FIRST: PageQuery = {
  page: 1,
  pageSize: 50,
  sort: "date",
  order: "desc",
};

async function idsOf(
  db: Database,
  query: Partial<PageQuery> & Pick<OwnerFixture, "ownerId">,
) {
  const page = await listNumberedTransactionPage(db, {
    ...NEWEST_FIRST,
    ...query,
  });
  return { ids: page.items.map((item) => item.id), total: page.total };
}

describe("listNumberedTransactionPage", () => {
  test("pages by number with the total of the filtered list", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const ids: string[] = [];
      for (const day of ["01", "02", "03", "04", "05"]) {
        ids.push(
          await insertTransaction(db, {
            ownerId: owner.ownerId,
            type: "expense",
            walletId: owner.cashId,
            categoryId: owner.childId,
            transactionDate: `2026-09-${day}`,
          }),
        );
      }
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "income",
        walletId: owner.cashId,
        categoryId: owner.incomeId,
        transactionDate: "2026-09-06",
      });
      const [first, second, third, fourth, fifth] = ids;

      expect(
        await idsOf(db, {
          ownerId: owner.ownerId,
          type: "expense",
          page: 1,
          pageSize: 2,
        }),
      ).toEqual({ ids: [fifth, fourth], total: 5 });
      expect(
        await idsOf(db, {
          ownerId: owner.ownerId,
          type: "expense",
          page: 3,
          pageSize: 2,
        }),
      ).toEqual({ ids: [first], total: 5 });
      expect(
        await idsOf(db, {
          ownerId: owner.ownerId,
          type: "expense",
          page: 4,
          pageSize: 2,
        }),
      ).toEqual({ ids: [], total: 5 });
      expect(
        await idsOf(db, {
          ownerId: owner.ownerId,
          type: "expense",
          from: "2026-09-02",
          to: "2026-09-03",
          order: "asc",
        }),
      ).toEqual({ ids: [second, third], total: 2 });
    });
  });

  test("sorts by date or amount either way, breaking ties by recording time then id", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      function insert({
        amount,
        recordedAt,
        type = "expense",
      }: {
        amount: bigint;
        recordedAt: string;
        type?: "expense" | "income";
      }) {
        return insertTransaction(db, {
          ownerId: owner.ownerId,
          type,
          walletId: owner.cashId,
          categoryId: type === "expense" ? owner.childId : owner.incomeId,
          amount,
          transactionDate: "2026-09-02",
          recordedAt: new Date(recordedAt),
        });
      }
      const small = await insert({
        amount: 1_000n,
        recordedAt: "2026-09-02T01:00:00.000Z",
      });
      const largeEarlier = await insert({
        amount: 9_000n,
        recordedAt: "2026-09-02T02:00:00.000Z",
      });
      const largeIncome = await insert({
        amount: 9_000n,
        recordedAt: "2026-09-02T03:00:00.000Z",
        type: "income",
      });
      const sameTime = [
        await insert({
          amount: 5_000n,
          recordedAt: "2026-09-02T04:00:00.000Z",
        }),
        await insert({
          amount: 5_000n,
          recordedAt: "2026-09-02T04:00:00.000Z",
        }),
      ].sort();

      expect(
        (
          await idsOf(db, {
            ownerId: owner.ownerId,
            sort: "amount",
            order: "desc",
          })
        ).ids,
      ).toEqual([largeIncome, largeEarlier, sameTime[1], sameTime[0], small]);
      expect(
        (
          await idsOf(db, {
            ownerId: owner.ownerId,
            sort: "amount",
            order: "asc",
          })
        ).ids,
      ).toEqual([small, sameTime[0], sameTime[1], largeEarlier, largeIncome]);
      expect(
        (
          await idsOf(db, {
            ownerId: owner.ownerId,
            sort: "date",
            order: "desc",
          })
        ).ids,
      ).toEqual([sameTime[1], sameTime[0], largeIncome, largeEarlier, small]);
      expect(
        (
          await idsOf(db, {
            ownerId: owner.ownerId,
            sort: "date",
            order: "asc",
          })
        ).ids,
      ).toEqual([small, largeEarlier, largeIncome, sameTime[0], sameTime[1]]);
    });
  });
});
