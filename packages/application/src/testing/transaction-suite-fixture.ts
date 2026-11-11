import type { Database } from "@bookkeeping/database/connection";
import { createTestUser } from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { eq } from "drizzle-orm";
import { vi } from "vitest";
import {
  initializeDefaultCategories,
  listCategories,
} from "../categories/category";
import { createTransaction } from "../transactions/transaction";
import { listWallets } from "../wallets/wallet";
import { createWalletForTest } from "./wallet-fixture";

export interface OwnerFixture {
  ownerId: string;
  cashId: string;
  bankId: string;
  parentId: string;
  childId: string;
  incomeId: string;
}

/** A fresh owner with two wallets and the default expense tree to file under. */
export async function setupOwner(db: Database): Promise<OwnerFixture> {
  const owner = await createTestUser(db);
  await initializeDefaultCategories(db, owner.id);
  const { id: cashId } = await createWalletForTest(db, {
    ownerId: owner.id,
    name: "Cash",
    type: "cash",
    openingAmount: 1_000_000n,
  });
  const { id: bankId } = await createWalletForTest(db, {
    ownerId: owner.id,
    name: "Bank",
    type: "bank_account",
    openingAmount: 0n,
  });
  const tree = await listCategories(db, owner.id);
  const parent = tree.find(
    (category) =>
      category.kind === "expense" && category.name === "Food & Drink",
  );
  const child = tree.find(
    (category) => category.kind === "expense" && category.name === "Groceries",
  );
  const income = tree.find(
    (category) => category.kind === "income" && category.name === "Salary",
  );
  if (!parent || !child || !income) {
    throw new Error("Missing default categories");
  }
  return {
    ownerId: owner.id,
    cashId,
    bankId,
    parentId: parent.id,
    childId: child.id,
    incomeId: income.id,
  };
}

export async function softDelete(db: Database, id: string): Promise<void> {
  await db
    .update(transactions)
    .set({ deletedAt: new Date() })
    .where(eq(transactions.id, id));
}

export function withClock<T>(iso: string, run: () => Promise<T>): Promise<T> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
  return run().finally(() => vi.useRealTimers());
}

/** A committed ฿500 groceries expense on 2 Sep from the owner's Cash wallet. */
export async function recordExpense(db: Database, owner: OwnerFixture) {
  const created = await createTransaction(db, {
    ownerId: owner.ownerId,
    idempotencyKey: `update-expense-${crypto.randomUUID()}`,
    type: "expense",
    walletId: owner.cashId,
    categoryId: owner.childId,
    amount: 50_000n,
    transactionDate: "2026-09-02",
    note: "Weekly shop",
  });
  if (!created.ok) {
    throw new Error(`Expected the expense to save, got ${created.error.code}`);
  }
  return created.value;
}

export interface UpdateExpenseInputOptions {
  owner: OwnerFixture;
  transaction: { id: string };
}

/** The valid edit of the fixture expense, before any overrides. */
export function expenseUpdateInput({
  owner,
  transaction,
}: Readonly<UpdateExpenseInputOptions>) {
  return {
    ownerId: owner.ownerId,
    id: transaction.id,
    walletId: owner.cashId,
    categoryId: owner.childId,
    amount: 50_000n,
    transactionDate: "2026-09-02",
    note: "Weekly shop",
    tagIds: [],
  };
}

export interface BalanceOptions {
  db: Database;
  ownerId: string;
  walletId: string;
  asOf?: string;
}

export async function balanceOf({
  db,
  ownerId,
  walletId,
  asOf,
}: Readonly<BalanceOptions>) {
  const summaries = await listWallets(db, { ownerId, asOf });
  const found = summaries.find((wallet) => wallet.id === walletId);
  if (!found) {
    throw new Error("Wallet not listed");
  }
  return found.balance;
}
