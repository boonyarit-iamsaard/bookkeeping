import {
  initializeDefaultCategories,
  listCategories,
} from "@bookkeeping/application/categories";
import type { Database } from "@bookkeeping/database/connection";
import { wallets } from "@bookkeeping/database/wallets";
import { createOwnerSession } from "./create-test-auth-gateway.js";

export interface ReportRequest {
  cookie?: string;
  query?: string;
}

export interface OwnerFixture {
  cookie: string;
  ownerId: string;
  cashId: string;
  bankId: string;
}

interface OwnerRequest {
  db: Database;
}

/** A fresh owner with two wallets and the default category trees. */
export async function createOwner({
  db,
}: Readonly<OwnerRequest>): Promise<OwnerFixture> {
  const { cookie, ownerId } = await createOwnerSession(db);
  await initializeDefaultCategories(db, ownerId);
  const [cash, bank] = await db
    .insert(wallets)
    .values([
      {
        userId: ownerId,
        name: "Cash",
        type: "cash",
        currency: "THB",
        openingAmount: 1_000_000n,
        openingDate: "2026-09-01",
      },
      {
        userId: ownerId,
        name: "Bank",
        type: "bank_account",
        currency: "THB",
        openingAmount: 0n,
        openingDate: "2026-09-01",
      },
    ])
    .returning({ id: wallets.id });
  if (!cash || !bank) {
    throw new Error("Wallet inserts returned no rows");
  }
  return { cookie, ownerId, cashId: cash.id, bankId: bank.id };
}

/** The owner's protected income category and a default expense category. */
export async function defaultCategories(db: Database, ownerId: string) {
  const tree = await listCategories(db, ownerId);
  const income = tree.find(
    (category) => category.kind === "income" && category.isProtected,
  );
  const expense = tree.find(
    (category) =>
      category.kind === "expense" && category.name === "Food & Drink",
  );
  if (!income || !expense) {
    throw new Error("Missing default categories");
  }
  return { income: income.id, expense: expense.id };
}
