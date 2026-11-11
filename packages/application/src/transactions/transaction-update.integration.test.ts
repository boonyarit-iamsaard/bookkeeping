import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { wallets } from "@bookkeeping/database/wallets";
import { inArray, sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { listCategories } from "../categories/category";
import { rejected } from "../shared/rejection";
import {
  balanceOf,
  expenseUpdateInput,
  insertWallet,
  recordExpense,
  setupOwner,
} from "../testing/transaction-suite-fixture";
import { archiveForTest } from "../testing/wallet-fixture";
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

describe("updateTransaction", () => {
  test("an edit replaces every financial effect, keeps the recording time, and leaves one history entry", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const savingsId = await insertWallet(db, {
        ownerId: owner.ownerId,
        name: "Savings",
        type: "bank_account",
        openingDate: "2026-09-03",
      });
      const uncategorized = (await listCategories(db, owner.ownerId)).find(
        (category) =>
          category.kind === "expense" && category.name === "Uncategorized",
      );
      if (!uncategorized) {
        throw new Error("Missing default expense category");
      }
      const transaction = await recordExpense(db, owner);
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.cashId,
        }),
      ).toBe(950_000n);

      const updated = await updateTransaction(db, {
        ...expenseUpdateInput({ owner, transaction }),
        walletId: savingsId,
        categoryId: uncategorized.id,
        amount: 75_050n,
        transactionDate: "2026-09-04",
        note: "Corrected",
      });

      if (!updated.ok) {
        throw new Error(`Expected the edit to save, got ${updated.error.code}`);
      }
      expect(updated.value).toEqual(
        expect.objectContaining({
          id: transaction.id,
          type: "expense",
          amount: 75_050n,
          transactionDate: "2026-09-04",
          note: "Corrected",
          recordedAt: transaction.recordedAt,
          wallet: expect.objectContaining({ id: savingsId }),
          category: expect.objectContaining({ name: "Uncategorized" }),
        }),
      );
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.cashId,
        }),
      ).toBe(1_000_000n);
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: savingsId }),
      ).toBe(-75_050n);
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: savingsId,
          asOf: "2026-09-03",
        }),
      ).toBe(0n);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: transaction.id,
        }),
      ).toEqual([
        expect.objectContaining({
          action: "edit",
          before: {
            type: "expense",
            walletId: owner.cashId,
            categoryId: owner.childId,
            amount: "50000",
            transactionDate: "2026-09-02",
            note: "Weekly shop",
          },
          after: {
            type: "expense",
            walletId: savingsId,
            categoryId: uncategorized.id,
            amount: "75050",
            transactionDate: "2026-09-04",
            note: "Corrected",
          },
        }),
      ]);
      // No visible reversal entry: the list still holds exactly one row.
      expect(
        await listTransactions(db, { ownerId: owner.ownerId }),
      ).toHaveLength(1);
    });
  });

  test("saving an edit that changes nothing succeeds without a history entry", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const transaction = await recordExpense(db, owner);
      const unchanged = await updateTransaction(db, {
        ...expenseUpdateInput({ owner, transaction }),
      });
      expect(unchanged.ok).toBe(true);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: transaction.id,
        }),
      ).toEqual([]);
    });
  });

  test("a rejected correction changes nothing and records no history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const transaction = await recordExpense(db, owner);

      expect(
        await updateTransaction(db, {
          ...expenseUpdateInput({ owner, transaction }),
          categoryId: owner.incomeId,
        }),
      ).toEqual({
        ok: false,
        error: rejected({
          field: "categoryId",
          code: "category-kind-mismatch",
        }),
      });

      expect(
        await findTransaction(db, {
          ownerId: owner.ownerId,
          id: transaction.id,
        }),
      ).toEqual(transaction);
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.cashId,
        }),
      ).toBe(950_000n);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: transaction.id,
        }),
      ).toEqual([]);
    });
  });

  describe("linked refunds", () => {
    /** A ฿500 groceries expense on 2 Sep from the owner's Cash wallet. */
    async function setupExpense(db: Database) {
      const owner = await setupOwner(db);
      const created = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `refund-expense-${crypto.randomUUID()}`,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 50_000n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      });
      if (!created.ok) {
        throw new Error("Expense failed");
      }
      return { ...owner, expense: created.value.transaction };
    }

    function refundInput(
      context: Readonly<{
        ownerId: string;
        cashId: string;
        expense: { id: string };
      }>,
      amount: bigint,
    ) {
      return {
        ownerId: context.ownerId,
        idempotencyKey: `refund-${crypto.randomUUID()}`,
        type: "refund",
        walletId: context.cashId,
        categoryId: null,
        refundOfTransactionId: context.expense.id,
        amount,
        transactionDate: "2026-09-03",
        note: "",
      } satisfies CreateTransactionInput;
    }

    test("an expense with refunds may shrink to their total, and its refunds follow its category", async () => {
      await withRollback(async (db) => {
        const context = await setupExpense(db);
        const { ownerId, cashId, childId, expense } = context;
        const early = await createTransaction(
          db,
          refundInput(context, 10_000n),
        );
        const late = await createTransaction(db, {
          ...refundInput(context, 5_000n),
          transactionDate: "2026-09-05",
        });
        if (!early.ok || !late.ok) {
          throw new Error("Refunds failed");
        }
        const uncategorized = (await listCategories(db, ownerId)).find(
          (category) =>
            category.kind === "expense" && category.name === "Uncategorized",
        );
        if (!uncategorized) {
          throw new Error("Missing default expense category");
        }
        const base = {
          ownerId,
          id: expense.id,
          walletId: cashId,
          categoryId: childId,
          amount: 50_000n,
          transactionDate: "2026-09-02",
          note: "Weekly shop",
        };
        const corrected = await updateTransaction(db, {
          ...base,
          categoryId: uncategorized.id,
          amount: 15_000n,
          transactionDate: "2026-09-03",
          tagIds: [],
        });
        expect(corrected.ok).toBe(true);
        // Every linked refund now reads the expense's new category.
        expect(
          (await listTransactions(db, { ownerId })).map((item) => [
            item.type,
            item.category?.name,
          ]),
        ).toEqual([
          ["refund", "Uncategorized"],
          ["refund", "Uncategorized"],
          ["expense", "Uncategorized"],
        ]);
        expect(
          await findExpenseRefunds(db, { ownerId, id: expense.id }),
        ).toEqual(
          expect.objectContaining({
            refundedTotal: 15_000n,
            refundAllowance: 0n,
          }),
        );
        expect(
          await listTransactionChanges(db, { ownerId, id: expense.id }),
        ).toEqual([
          expect.objectContaining({
            action: "edit",
            before: expect.objectContaining({ amount: "50000" }),
            after: expect.objectContaining({ amount: "15000" }),
          }),
        ]);
      });
    });

    test("refund corrections exclude their own old amount, keep recording time and history, and may keep their archived wallet", async () => {
      await withRollback(async (db) => {
        const context = await setupExpense(db);
        const { ownerId, cashId, expense } = context;
        const bank = await insertWallet(db, {
          ownerId,
          name: "Bank",
          type: "bank_account",
        });
        const first = await createTransaction(
          db,
          refundInput(context, 30_000n),
        );
        const second = await createTransaction(
          db,
          refundInput(context, 10_000n),
        );
        if (!first.ok || !second.ok) {
          throw new Error("Refunds failed");
        }
        const { id, recordedAt } = first.value.transaction;
        const base = {
          ownerId,
          id,
          walletId: cashId,
          categoryId: null,
          refundOfTransactionId: expense.id,
          amount: 30_000n,
          transactionDate: "2026-09-03",
          note: "",
        };
        // ฿10,000 is held by the other refund; this refund's own ฿30,000 is free.
        const grown = await updateTransaction(db, {
          ...base,
          walletId: bank,
          amount: 40_000n,
          transactionDate: "2026-09-04",
          tagIds: [],
        });
        expect(grown.ok && grown.value).toEqual(
          expect.objectContaining({
            recordedAt,
            amount: 40_000n,
            wallet: expect.objectContaining({ id: bank }),
            category: expect.objectContaining({ name: "Groceries" }),
            refundOf: expect.objectContaining({ id: expense.id }),
          }),
        );
        expect(
          (await listWallets(db, { ownerId })).map((w) => w.balance),
        ).toEqual([960_000n, 0n, 40_000n]);

        await db
          .update(wallets)
          .set({ archivedAt: new Date() })
          .where(inArray(wallets.id, [bank]));
        // Retaining its own archived wallet is allowed.
        expect(
          (
            await updateTransaction(db, {
              ...base,
              walletId: bank,
              amount: 39_999n,
              transactionDate: "2026-09-04",
              tagIds: [],
            })
          ).ok,
        ).toBe(true);
        const history = await listTransactionChanges(db, { ownerId, id });
        expect(history).toEqual([
          expect.objectContaining({
            action: "edit",
            before: expect.objectContaining({
              type: "refund",
              refundOfTransactionId: expense.id,
              amount: "30000",
            }),
            after: expect.objectContaining({
              walletId: bank,
              amount: "40000",
            }),
          }),
          expect.objectContaining({ action: "edit" }),
        ]);
        expect(await deleteTransaction(db, { ownerId, id })).toEqual({
          ok: true,
          value: { id },
        });
        expect(
          await findExpenseRefunds(db, { ownerId, id: expense.id }),
        ).toEqual(
          expect.objectContaining({
            refundedTotal: 10_000n,
            refundAllowance: 40_000n,
          }),
        );
        expect(
          (await listWallets(db, { ownerId })).map((w) => w.balance),
        ).toEqual([960_000n, 0n, 0n]);
      });
    });

    const refundConcurrencyCases = [
      ["create", "amount"],
      ["create", "date"],
      ["create", "archive"],
      ["edit", "date"],
      ["edit", "delete"],
      ["edit", "archive"],
    ] as const;
    for (const [operation, conflict] of refundConcurrencyCases) {
      test(`refund ${operation} racing ${conflict} preserves financial constraints and history`, async () => {
        const db = committed();
        const context = await setupExpense(db);
        const { ownerId, cashId, expense } = context;
        const receiver = await insertWallet(db, {
          ownerId,
          name: "Refund receiver",
          type: "bank_account",
        });
        const existing =
          operation === "edit"
            ? await createTransaction(db, refundInput(context, 10_000n))
            : undefined;
        if (existing && !existing.ok) {
          throw new Error("Initial refund failed");
        }
        const refundId = existing?.ok
          ? existing.value.transaction.id
          : undefined;
        const refundWrite = refundId
          ? updateTransaction(db, {
              ownerId,
              id: refundId,
              walletId: receiver,
              categoryId: null,
              amount: 40_000n,
              transactionDate: "2026-09-03",
              note: "Corrected refund",
              tagIds: [],
            })
          : createTransaction(db, {
              ...refundInput(context, 40_000n),
              walletId: receiver,
            });
        const competingWrite =
          conflict === "archive"
            ? archiveForTest(db, { ownerId, id: receiver })
            : conflict === "delete"
              ? deleteTransaction(db, { ownerId, id: expense.id })
              : updateTransaction(db, {
                  ownerId,
                  id: expense.id,
                  walletId: cashId,
                  categoryId: expense.category?.id ?? null,
                  amount: conflict === "amount" ? 30_000n : expense.amount,
                  transactionDate:
                    conflict === "date"
                      ? "2026-09-04"
                      : expense.transactionDate,
                  note: expense.note,
                  tagIds: [],
                });
        const [refundResult, competingResult] = await Promise.all([
          refundWrite,
          competingWrite,
        ]);
        if (conflict === "archive") {
          if (!refundResult.ok) {
            expect(refundResult.error).toEqual(
              rejected({ field: "walletId", code: "wallet-archived" }),
            );
          }
          expect(
            await createTransaction(db, {
              ...refundInput(context, 1n),
              walletId: receiver,
            }),
          ).toEqual({
            ok: false,
            error: rejected({ field: "walletId", code: "wallet-archived" }),
          });
        } else if (
          operation === "edit" &&
          (conflict === "date" || conflict === "delete")
        ) {
          // Even the old refund blocks these expense changes.
          expect(refundResult.ok).toBe(true);
          expect(competingResult.ok).toBe(false);
        } else {
          expect(
            [refundResult.ok, competingResult.ok].filter(Boolean),
          ).toHaveLength(1);
        }
        const current = await findTransaction(db, { ownerId, id: expense.id });
        const summary = await findExpenseRefunds(db, {
          ownerId,
          id: expense.id,
        });
        const expectedTotal = refundResult.ok
          ? 40_000n
          : operation === "edit"
            ? 10_000n
            : 0n;
        if (current && summary) {
          expect(summary.refundedTotal).toBe(expectedTotal);
          expect(current.amount).toBeGreaterThanOrEqual(summary.refundedTotal);
          expect(
            summary.refunds.every(
              (refund) => refund.transactionDate >= current.transactionDate,
            ),
          ).toBe(true);
        } else {
          expect(conflict).toBe("delete");
          expect(competingResult.ok).toBe(true);
          expect(expectedTotal).toBe(0n);
        }
        const balances = await listWallets(db, { ownerId });
        expect(balances.find((entry) => entry.id === receiver)?.balance).toBe(
          refundResult.ok ? 40_000n : 0n,
        );
        expect(balances.find((entry) => entry.id === cashId)?.balance).toBe(
          1_000_000n -
            (current?.amount ?? 0n) +
            (!refundResult.ok && operation === "edit" ? 10_000n : 0n),
        );
        expect(
          await listTransactionChanges(db, { ownerId, id: expense.id }),
        ).toHaveLength(competingResult.ok && conflict !== "archive" ? 1 : 0);
        if (refundId) {
          expect(
            await listTransactionChanges(db, { ownerId, id: refundId }),
          ).toHaveLength(refundResult.ok ? 1 : 0);
          expect(
            (await findTransaction(db, { ownerId, id: refundId }))?.recordedAt,
          ).toEqual(
            existing?.ok ? existing.value.transaction.recordedAt : undefined,
          );
        }
      });
    }

    test("a failed history write rolls back refund corrections and expense guards leave no partial effect", async () => {
      await withRollback(async (db) => {
        const context = await setupExpense(db);
        const { ownerId, cashId, expense } = context;
        const refund = await createTransaction(
          db,
          refundInput(context, 20_000n),
        );
        if (!refund.ok) {
          throw new Error("Refund failed");
        }
        const id = refund.value.transaction.id;
        await db.execute(
          sql`alter table transaction_changes add constraint fail_refund_history check (transaction_id is null) not valid`,
        );
        await expect(
          updateTransaction(db, {
            ownerId,
            id,
            walletId: cashId,
            categoryId: null,
            amount: 30_000n,
            transactionDate: "2026-09-03",
            note: "",
            tagIds: [],
          }),
        ).rejects.toThrow();
        await db.execute(
          sql`alter table transaction_changes drop constraint fail_refund_history`,
        );
        expect(await findTransaction(db, { ownerId, id })).toEqual(
          refund.value.transaction,
        );
        expect(
          await findExpenseRefunds(db, { ownerId, id: expense.id }),
        ).toEqual(
          expect.objectContaining({
            refundedTotal: 20_000n,
            refundAllowance: 30_000n,
          }),
        );
        expect(
          (await listWallets(db, { ownerId })).map((w) => w.balance),
        ).toEqual([970_000n, 0n]);
      });
    });
  });

  test("simultaneous edits serialize: every one lands in history and the balance matches the last", async () => {
    const db = committed();
    const owner = await setupOwner(db);
    const transaction = await recordExpense(db, owner);
    const amounts = [1_000n, 2_000n, 3_000n, 4_000n, 5_000n];

    const outcomes = await Promise.all(
      amounts.map((amount) =>
        updateTransaction(db, {
          ownerId: owner.ownerId,
          id: transaction.id,
          walletId: owner.cashId,
          categoryId: owner.childId,
          amount,
          transactionDate: "2026-09-02",
          note: "Weekly shop",
          tagIds: [],
        }),
      ),
    );

    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
    const history = await listTransactionChanges(db, {
      ownerId: owner.ownerId,
      id: transaction.id,
    });
    expect(history).toHaveLength(5);
    // Each entry starts where the previous one ended.
    for (let index = 1; index < history.length; index += 1) {
      expect(history[index]?.before).toEqual(history[index - 1]?.after);
    }
    const final = await findTransaction(db, {
      ownerId: owner.ownerId,
      id: transaction.id,
    });
    expect(final?.amount).toBe(BigInt(history[4]?.after?.amount ?? "0"));
    expect(
      await balanceOf({
        db,
        ownerId: owner.ownerId,
        walletId: owner.cashId,
      }),
    ).toBe(1_000_000n - (final?.amount ?? 0n));
  });

  test("an expense edit and a refund edit of one expense serialize on the expense and leave the link consistent", async () => {
    const db = committed();
    const owner = await setupOwner(db);
    const expense = await recordExpense(db, owner);
    const refund = await createTransaction(db, {
      ownerId: owner.ownerId,
      idempotencyKey: `race-refund-${crypto.randomUUID()}`,
      type: "refund",
      walletId: owner.cashId,
      categoryId: null,
      refundOfTransactionId: expense.id,
      amount: 10_000n,
      transactionDate: "2026-09-03",
      note: "",
    });
    if (!refund.ok) {
      throw new Error("Refund failed");
    }

    // Either order ends consistent: ฿300.00 covers the ฿250.00 refund, and
    // ฿250.00 fits inside whatever the expense currently is.
    const [shrunk, grown] = await Promise.all([
      updateTransaction(db, {
        ...expenseUpdateInput({ owner, transaction: expense }),
        amount: 30_000n,
      }),
      updateTransaction(db, {
        ownerId: owner.ownerId,
        id: refund.value.transaction.id,
        walletId: owner.cashId,
        categoryId: null,
        amount: 25_000n,
        transactionDate: "2026-09-03",
        note: "",
        tagIds: [],
      }),
    ]);

    expect(shrunk.ok).toBe(true);
    expect(grown.ok).toBe(true);
    const refunds = await findExpenseRefunds(db, {
      ownerId: owner.ownerId,
      id: expense.id,
    });
    expect(refunds).toEqual(
      expect.objectContaining({
        refundedTotal: 25_000n,
        refundAllowance: 5_000n,
        refunds: [
          expect.objectContaining({
            id: refund.value.transaction.id,
            amount: 25_000n,
          }),
        ],
      }),
    );
  });

  test("a transfer correction retains or swaps its own archived wallets", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: `retained-transfer-${crypto.randomUUID()}`,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        categoryId: null,
        amount: 100n,
        transactionDate: "2026-09-05",
        note: "",
      } satisfies CreateTransactionInput;
      const created = await createTransaction(db, input);
      if (!created.ok) {
        throw new Error("Transfer failed");
      }
      const id = created.value.transaction.id;
      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(inArray(wallets.id, [owner.cashId, owner.bankId]));

      const kept = await updateTransaction(db, {
        ownerId: owner.ownerId,
        id,
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        categoryId: null,
        amount: 200n,
        transactionDate: "2026-09-05",
        note: "",
        tagIds: [],
      });
      expect(kept.ok).toBe(true);
      const swapped = await updateTransaction(db, {
        ownerId: owner.ownerId,
        id,
        walletId: owner.bankId,
        destinationWalletId: owner.cashId,
        categoryId: null,
        amount: 300n,
        transactionDate: "2026-09-05",
        note: "",
        tagIds: [],
      });
      expect(swapped.ok).toBe(true);
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.cashId,
        }),
      ).toBe(1_000_300n);
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.bankId,
        }),
      ).toBe(-300n);
    });
  });

  test("editing a transfer replaces both wallets and deletion removes both effects and retains history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const travel = await insertWallet(db, {
        ownerId: owner.ownerId,
        name: "Travel",
        type: "cash",
      });
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: `transfer-edit-${crypto.randomUUID()}`,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        categoryId: null,
        amount: 100_000n,
        transactionDate: "2026-09-02",
        note: "",
      } satisfies CreateTransactionInput;
      const created = await createTransaction(db, input);
      if (!created.ok) {
        throw new Error("Transfer failed");
      }
      const { id, recordedAt } = created.value.transaction;
      const edited = await updateTransaction(db, {
        ...input,
        id,
        walletId: owner.bankId,
        destinationWalletId: travel,
        amount: 200_001n,
        transactionDate: "2026-09-03",
        tagIds: [],
      });
      expect(edited.ok && edited.value.recordedAt).toEqual(recordedAt);
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (w) => w.balance,
        ),
      ).toEqual([1_000_000n, -200_001n, 200_001n]);
      expect(
        (
          await listWallets(db, { ownerId: owner.ownerId, asOf: "2026-09-02" })
        ).map((w) => w.balance),
      ).toEqual([1_000_000n, 0n, 0n]);
      expect(
        await deleteTransaction(db, { ownerId: owner.ownerId, id }),
      ).toEqual({ ok: true, value: { id } });
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (w) => w.balance,
        ),
      ).toEqual([1_000_000n, 0n, 0n]);
      const history = await listTransactionChanges(db, {
        ownerId: owner.ownerId,
        id,
      });
      expect(history).toEqual([
        expect.objectContaining({
          action: "edit",
          before: expect.objectContaining({
            walletId: owner.cashId,
            destinationWalletId: owner.bankId,
          }),
          after: expect.objectContaining({
            walletId: owner.bankId,
            destinationWalletId: travel,
            amount: "200001",
          }),
        }),
        expect.objectContaining({ action: "delete", after: null }),
      ]);
      const replay = await createTransaction(db, input);
      expect(replay.ok && replay.value.replayed).toBe(true);
      expect(await listTransactions(db, { ownerId: owner.ownerId })).toEqual(
        [],
      );
    });
  });

  test("a failed history write rolls the financial update back and leaves no history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: "rollback-transfer",
        type: "transfer",
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
      // Inject a storage fault at the audit boundary, after the financial
      // update. DDL lives in this rolled-back test transaction and never
      // touches application databases.
      await db.execute(
        sql`alter table transaction_changes add constraint fail_update_history check (transaction_id is null) not valid`,
      );
      await expect(
        updateTransaction(db, {
          ownerId: owner.ownerId,
          id,
          walletId: owner.cashId,
          destinationWalletId: owner.bankId,
          categoryId: null,
          amount: 200_000n,
          transactionDate: "2026-09-05",
          note: "",
          tagIds: [],
        }),
      ).rejects.toThrow();
      expect(await findTransaction(db, { ownerId: owner.ownerId, id })).toEqual(
        created.value.transaction,
      );
      expect(
        await listTransactionChanges(db, { ownerId: owner.ownerId, id }),
      ).toEqual([]);
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.cashId,
        }),
      ).toBe(900_000n);
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.bankId,
        }),
      ).toBe(100_000n);

      await db.execute(
        sql`alter table transaction_changes drop constraint fail_update_history`,
      );
      const recovered = await updateTransaction(db, {
        ownerId: owner.ownerId,
        id,
        walletId: owner.bankId,
        destinationWalletId: owner.cashId,
        categoryId: null,
        amount: 100_000n,
        transactionDate: "2026-09-05",
        note: "",
        tagIds: [],
      });
      expect(recovered.ok).toBe(true);
    });
  });
});
