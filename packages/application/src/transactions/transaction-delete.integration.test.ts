import { setupTestDatabase } from "@bookkeeping/database/testing";
import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import {
  balanceOf,
  recordExpense,
  setupOwner,
} from "../testing/transaction-suite-fixture";
import { listWallets } from "../wallets/wallet";
import type { CreateTransactionInput } from "./transaction";
import {
  createTransaction,
  deleteTransaction,
  findExpenseRefunds,
  findTransaction,
  listTransactionChanges,
  listTransactions,
  updateTransaction,
} from "./transaction";

const { withRollback, committed } = setupTestDatabase();

describe("deleteTransaction", () => {
  test("removing an income or expense clears its effects from lists, detail, and balances, and keeps one delete entry", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await recordExpense(db, owner);
      const income = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `delete-income-${crypto.randomUUID()}`,
        type: "income",
        walletId: owner.bankId,
        categoryId: owner.incomeId,
        amount: 30_000n,
        transactionDate: "2026-09-03",
        note: "Salary",
      });
      if (!income.ok) {
        throw new Error("Expected the income to save");
      }
      const incomeId = income.value.transaction.id;
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.cashId }),
      ).toBe(950_000n);
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.bankId }),
      ).toBe(30_000n);

      expect(
        await deleteTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).toEqual({ ok: true, value: { id: expense.id } });
      expect(
        await findTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).toBeNull();
      expect(
        (await listTransactions(db, { ownerId: owner.ownerId })).map(
          (transaction) => transaction.id,
        ),
      ).toEqual([incomeId]);
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.cashId }),
      ).toBe(1_000_000n);
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.cashId,
          asOf: "2026-09-02",
        }),
      ).toBe(1_000_000n);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toEqual([
        expect.objectContaining({
          action: "delete",
          before: expect.objectContaining({ amount: "50000" }),
          after: null,
        }),
      ]);

      // Repeating the deletion is the same outcome, without new history.
      expect(
        await deleteTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).toEqual({ ok: true, value: { id: expense.id } });
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toHaveLength(1);

      expect(
        await deleteTransaction(db, { ownerId: owner.ownerId, id: incomeId }),
      ).toEqual({
        ok: true,
        value: { id: incomeId },
      });
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.bankId }),
      ).toBe(0n);
    });
  });

  test("a late create retry after a deletion confirms the original outcome without recreating it", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: "delete-retry",
        type: "expense" as const,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 50_000n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      } satisfies CreateTransactionInput;
      const created = await createTransaction(db, input);
      if (!created.ok) {
        throw new Error("Expected the expense to save");
      }
      await deleteTransaction(db, {
        ownerId: owner.ownerId,
        id: created.value.transaction.id,
      });

      const retry = await createTransaction(db, input);
      expect(retry).toEqual({
        ok: true,
        value: { transaction: created.value.transaction, replayed: true },
      });
      expect(await listTransactions(db, { ownerId: owner.ownerId })).toEqual(
        [],
      );
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.cashId }),
      ).toBe(1_000_000n);
    });
  });

  test("deleting a transfer removes both wallet effects and retains history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const created = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `delete-transfer-${crypto.randomUUID()}`,
        type: "transfer",
        currency: "THB",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        categoryId: null,
        amount: 100_000n,
        transactionDate: "2026-09-02",
        note: "Move money",
      });
      if (!created.ok) {
        throw new Error("Expected the transfer to save");
      }
      const id = created.value.transaction.id;

      expect(
        await deleteTransaction(db, { ownerId: owner.ownerId, id }),
      ).toEqual({ ok: true, value: { id } });
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (wallet) => wallet.balance,
        ),
      ).toEqual([1_000_000n, 0n]);
      expect(
        await listTransactionChanges(db, { ownerId: owner.ownerId, id }),
      ).toEqual([
        expect.objectContaining({
          action: "delete",
          before: expect.objectContaining({
            type: "transfer",
            destinationWalletId: owner.bankId,
            amount: "100000",
          }),
          after: null,
        }),
      ]);
    });
  });

  test("deleting a refund removes its effect and restores the expense's refundable remainder", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await recordExpense(db, owner);
      const refund = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `delete-refund-${crypto.randomUUID()}`,
        type: "refund",
        walletId: owner.bankId,
        categoryId: null,
        refundOfTransactionId: expense.id,
        amount: 20_000n,
        transactionDate: "2026-09-03",
        note: "Returned",
      });
      if (!refund.ok) {
        throw new Error("Expected the refund to save");
      }
      const refundId = refund.value.transaction.id;

      expect(
        await deleteTransaction(db, { ownerId: owner.ownerId, id: refundId }),
      ).toEqual({ ok: true, value: { id: refundId } });
      expect(
        await findExpenseRefunds(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toEqual({ refunds: [], refundedTotal: 0n, remaining: 50_000n });
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.bankId }),
      ).toBe(0n);
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.cashId }),
      ).toBe(950_000n);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: refundId,
        }),
      ).toEqual([
        expect.objectContaining({
          action: "delete",
          before: expect.objectContaining({
            type: "refund",
            refundOfTransactionId: expense.id,
            amount: "20000",
          }),
          after: null,
        }),
      ]);
    });
  });

  test("an expense with linked refunds stays and is refused with the refunds until they are gone", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await recordExpense(db, owner);
      const first = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `guard-refund-1-${crypto.randomUUID()}`,
        type: "refund",
        walletId: owner.bankId,
        categoryId: null,
        refundOfTransactionId: expense.id,
        amount: 10_000n,
        transactionDate: "2026-09-03",
        note: "",
      });
      const second = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `guard-refund-2-${crypto.randomUUID()}`,
        type: "refund",
        walletId: owner.bankId,
        categoryId: null,
        refundOfTransactionId: expense.id,
        amount: 5_000n,
        transactionDate: "2026-09-05",
        note: "",
      });
      if (!first.ok || !second.ok) {
        throw new Error("Expected both refunds to save");
      }
      const refundIds = [
        first.value.transaction.id,
        second.value.transaction.id,
      ];

      expect(
        await deleteTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).toEqual({
        ok: false,
        error: {
          code: "refunds-exist",
          refunds: [
            expect.objectContaining({
              amount: 10_000n,
              transactionDate: "2026-09-03",
            }),
            expect.objectContaining({
              amount: 5_000n,
              transactionDate: "2026-09-05",
            }),
          ],
        },
      });
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toEqual([]);
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.cashId }),
      ).toBe(950_000n);
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.bankId }),
      ).toBe(15_000n);

      for (const id of refundIds) {
        expect(
          await deleteTransaction(db, { ownerId: owner.ownerId, id }),
        ).toEqual({ ok: true, value: { id } });
      }
      expect(
        await deleteTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).toEqual({ ok: true, value: { id: expense.id } });
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (wallet) => wallet.balance,
        ),
      ).toEqual([1_000_000n, 0n]);
    });
  });

  test("another owner's and unknown transactions are not found", async () => {
    await withRollback(async (db) => {
      const alice = await setupOwner(db);
      const bob = await setupOwner(db);
      const expense = await recordExpense(db, alice);

      expect(
        await deleteTransaction(db, { ownerId: bob.ownerId, id: expense.id }),
      ).toEqual({ ok: false, error: { code: "transaction-not-found" } });
      expect(
        await deleteTransaction(db, {
          ownerId: bob.ownerId,
          id: "01999999-0000-7000-8000-000000000000",
        }),
      ).toEqual({ ok: false, error: { code: "transaction-not-found" } });
      expect(
        await findTransaction(db, { ownerId: alice.ownerId, id: expense.id }),
      ).toEqual(expense);
      expect(
        await balanceOf({ db, ownerId: alice.ownerId, walletId: alice.cashId }),
      ).toBe(950_000n);
    });
  });

  test("a failed history write rolls the soft deletion back and leaves no partial effect", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await recordExpense(db, owner);
      // Inject a storage fault at the audit boundary, after the soft
      // deletion. DDL lives in this rolled-back test transaction and never
      // touches application databases.
      await db.execute(
        sql`alter table transaction_changes add constraint fail_delete_history check (transaction_id is null) not valid`,
      );
      await expect(
        deleteTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).rejects.toThrow();

      expect(
        await findTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).toEqual(expense);
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.cashId }),
      ).toBe(950_000n);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toEqual([]);
    });
  });

  test("receipt or history write failures roll back both transfer effects and leave no partial receipt or history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: "fail-transfer-delete-history",
        type: "transfer",
        currency: "THB",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        categoryId: null,
        amount: 100_000n,
        transactionDate: "2026-09-05",
        note: "",
      } satisfies CreateTransactionInput;
      const created = await createTransaction(db, input);
      if (!created.ok) {
        throw new Error("Transfer failed");
      }
      const id = created.value.transaction.id;
      await db.execute(
        sql`alter table transaction_changes add constraint fail_transfer_delete_history check (transaction_id is null) not valid`,
      );
      await expect(
        deleteTransaction(db, { ownerId: owner.ownerId, id }),
      ).rejects.toThrow();
      expect(await findTransaction(db, { ownerId: owner.ownerId, id })).toEqual(
        created.value.transaction,
      );
      expect(
        await listTransactionChanges(db, { ownerId: owner.ownerId, id }),
      ).toEqual([]);
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (wallet) => wallet.balance,
        ),
      ).toEqual([900_000n, 100_000n]);
    });
  });

  test("a failed history write rolls back refund corrections and expense guards leave no partial effect", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await recordExpense(db, owner);
      const refund = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: "fail-refund-delete-history",
        type: "refund",
        walletId: owner.cashId,
        categoryId: null,
        refundOfTransactionId: expense.id,
        amount: 20_000n,
        transactionDate: "2026-09-03",
        note: "",
      });
      if (!refund.ok) {
        throw new Error("Refund failed");
      }
      const id = refund.value.transaction.id;
      await db.execute(
        sql`alter table transaction_changes add constraint fail_refund_delete_history check (transaction_id is null) not valid`,
      );
      await expect(
        deleteTransaction(db, { ownerId: owner.ownerId, id }),
      ).rejects.toThrow();
      expect(await findTransaction(db, { ownerId: owner.ownerId, id })).toEqual(
        refund.value.transaction,
      );
      expect(
        await findExpenseRefunds(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toEqual(
        expect.objectContaining({ refundedTotal: 20_000n, remaining: 30_000n }),
      );
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (wallet) => wallet.balance,
        ),
      ).toEqual([970_000n, 0n]);
    });
  });

  test("a refund deletion and an expense reduction serialize so the committed records stay consistent", async () => {
    const db = committed();
    const owner = await setupOwner(db);
    const expense = await recordExpense(db, owner);
    const refund = await createTransaction(db, {
      ownerId: owner.ownerId,
      idempotencyKey: `race-refund-${crypto.randomUUID()}`,
      type: "refund",
      walletId: owner.bankId,
      categoryId: null,
      refundOfTransactionId: expense.id,
      amount: 35_000n,
      transactionDate: "2026-09-03",
      note: "",
    });
    if (!refund.ok) {
      throw new Error("Expected the refund to save");
    }

    const [deleted, reduced] = await Promise.all([
      deleteTransaction(db, {
        ownerId: owner.ownerId,
        id: refund.value.transaction.id,
      }),
      updateTransaction(db, {
        ownerId: owner.ownerId,
        id: expense.id,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 15_000n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      }),
    ]);

    expect(deleted.ok).toBe(true);
    const summary = await findExpenseRefunds(db, {
      ownerId: owner.ownerId,
      id: expense.id,
    });
    const current = await findTransaction(db, {
      ownerId: owner.ownerId,
      id: expense.id,
    });
    expect(summary?.refundedTotal).toBe(0n);
    expect(current?.amount).toBe(reduced.ok ? 15_000n : 50_000n);
    expect(
      await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.cashId }),
    ).toBe(1_000_000n - (current?.amount ?? 0n));
    expect(
      await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.bankId }),
    ).toBe(0n);
  });

  test("an expense deletion and a competing refund creation serialize on the locked expense", async () => {
    const db = committed();
    const owner = await setupOwner(db);
    const expense = await recordExpense(db, owner);

    const [deleted, refunded] = await Promise.all([
      deleteTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `race-refund-2-${crypto.randomUUID()}`,
        type: "refund",
        walletId: owner.bankId,
        categoryId: null,
        refundOfTransactionId: expense.id,
        amount: 10_000n,
        transactionDate: "2026-09-03",
        note: "",
      }),
    ]);

    // Either the expense goes first and the refund cannot link to it, or the
    // refund lands first and the expense stays to cover it.
    if (deleted.ok) {
      expect(refunded).toEqual({
        ok: false,
        error: { field: "refundOfTransactionId", code: "expense-not-found" },
      });
      expect(await listTransactions(db, { ownerId: owner.ownerId })).toEqual(
        [],
      );
    } else {
      expect(refunded.ok).toBe(true);
      if (!refunded.ok) {
        throw new Error("Expected the competing refund to save");
      }
      expect(deleted).toEqual({
        ok: false,
        error: {
          code: "refunds-exist",
          refunds: [
            expect.objectContaining({ id: refunded.value.transaction.id }),
          ],
        },
      });
      expect(
        await findTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).toEqual(expense);
      expect(
        await findExpenseRefunds(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toEqual(
        expect.objectContaining({ refundedTotal: 10_000n, remaining: 40_000n }),
      );
    }
  });
});
