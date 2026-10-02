import {
  initializeDefaultCategories,
  listCategories,
} from "@bookkeeping/application/categories";
import { insertTransaction } from "@bookkeeping/application/testing/transaction-fixture";
import { categories as categoryTable } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { afterEach, describe, expect, test, vi } from "vitest";
import { presentMoney } from "../../core/http/money.js";
import type { AppEnv } from "../../core/http/request-context.js";
import {
  createIntegrationTestApp,
  TEST_API_ORIGIN,
} from "../../testing/create-integration-test-app.js";
import {
  createOwnerSession,
  createTestAuthGateway,
} from "../../testing/create-test-auth-gateway.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectProblem } from "../../testing/expect-problem.js";
import { walletCollectionResponseSchema } from "../wallets/wallet.routes.js";
import {
  categorySpendingResponseSchema,
  closingBalancesResponseSchema,
  monthlyReportResponseSchema,
} from "./report.routes.js";

const { withRollback } = setupTestDatabase();

const REPORTS_URL = `${TEST_API_ORIGIN}/v1/reports/monthly`;
const CATEGORY_SPENDING_URL = `${TEST_API_ORIGIN}/v1/reports/category-spending`;
const CLOSING_BALANCES_URL = `${TEST_API_ORIGIN}/v1/reports/closing-balances`;
const WALLETS_URL = `${TEST_API_ORIGIN}/v1/wallets`;

interface OwnerFixture {
  cookie: string;
  ownerId: string;
  cashId: string;
  bankId: string;
}

interface OwnerRequest {
  db: Database;
}

/** A fresh owner with two wallets and the default category trees. */
async function createOwner({
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
async function defaultCategories(db: Database, ownerId: string) {
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

interface ReportRequest {
  cookie?: string;
  query?: string;
}

function getMonthlyReport(
  app: Hono<AppEnv>,
  { cookie, query }: Readonly<ReportRequest> = {},
) {
  return app.request(`${REPORTS_URL}${query ? `?${query}` : ""}`, {
    headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

describe("GET /v1/reports/monthly", () => {
  test("totals a month as exact canonical money and excludes transfers", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const categories = await defaultCategories(db, owner.ownerId);
      const expenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: categories.expense,
        amount: 50_000n,
        transactionDate: "2026-09-02",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "income",
        walletId: owner.cashId,
        categoryId: categories.income,
        amount: 100_000n,
        transactionDate: "2026-09-03",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: expenseId,
        amount: 10_000n,
        transactionDate: "2026-09-04",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        amount: 200_000n,
        transactionDate: "2026-09-05",
      });

      const response = await getMonthlyReport(app, {
        cookie: owner.cookie,
        query: "month=2026-09",
      });
      const report = monthlyReportResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(report).toEqual({
        month: "2026-09",
        income: { value: "1000.00", currency: "THB" },
        grossExpenses: { value: "500.00", currency: "THB" },
        refunds: { value: "100.00", currency: "THB" },
        netExpenses: { value: "400.00", currency: "THB" },
        net: { value: "600.00", currency: "THB" },
        transactionCount: 3,
      });
    });
  });

  test("counts refunds in their own transaction month and deleted transactions out", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const categories = await defaultCategories(db, owner.ownerId);
      const expenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: categories.expense,
        amount: 50_000n,
        transactionDate: "2026-09-30",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: expenseId,
        amount: 5_000n,
        transactionDate: "2026-10-01",
      });
      const deletedIncomeId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "income",
        walletId: owner.cashId,
        categoryId: categories.income,
        amount: 70_000n,
        transactionDate: "2026-10-02",
      });
      await db
        .update(transactions)
        .set({ deletedAt: new Date() })
        .where(eq(transactions.id, deletedIncomeId));

      const october = monthlyReportResponseSchema.parse(
        await (
          await getMonthlyReport(app, {
            cookie: owner.cookie,
            query: "month=2026-10",
          })
        ).json(),
      );
      expect(october).toEqual({
        month: "2026-10",
        income: { value: "0.00", currency: "THB" },
        grossExpenses: { value: "0.00", currency: "THB" },
        refunds: { value: "50.00", currency: "THB" },
        netExpenses: { value: "-50.00", currency: "THB" },
        net: { value: "50.00", currency: "THB" },
        transactionCount: 1,
      });

      const september = monthlyReportResponseSchema.parse(
        await (
          await getMonthlyReport(app, {
            cookie: owner.cookie,
            query: "month=2026-09",
          })
        ).json(),
      );
      expect(september).toEqual({
        month: "2026-09",
        income: { value: "0.00", currency: "THB" },
        grossExpenses: { value: "500.00", currency: "THB" },
        refunds: { value: "0.00", currency: "THB" },
        netExpenses: { value: "500.00", currency: "THB" },
        net: { value: "-500.00", currency: "THB" },
        transactionCount: 1,
      });
    });
  });

  test("reports an empty month and another owner's month as zeros", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const foreign = await createOwner({ db });
      const categories = await defaultCategories(db, foreign.ownerId);
      await insertTransaction(db, {
        ownerId: foreign.ownerId,
        type: "income",
        walletId: foreign.cashId,
        categoryId: categories.income,
        amount: 700_000n,
        transactionDate: "2026-09-02",
      });

      const empty = monthlyReportResponseSchema.parse(
        await (
          await getMonthlyReport(app, {
            cookie: owner.cookie,
            query: "month=2026-08",
          })
        ).json(),
      );
      expect(empty).toEqual({
        month: "2026-08",
        income: { value: "0.00", currency: "THB" },
        grossExpenses: { value: "0.00", currency: "THB" },
        refunds: { value: "0.00", currency: "THB" },
        netExpenses: { value: "0.00", currency: "THB" },
        net: { value: "0.00", currency: "THB" },
        transactionCount: 0,
      });

      const foreignMonth = monthlyReportResponseSchema.parse(
        await (
          await getMonthlyReport(app, {
            cookie: owner.cookie,
            query: "month=2026-09",
          })
        ).json(),
      );
      expect(foreignMonth).toEqual({
        month: "2026-09",
        income: { value: "0.00", currency: "THB" },
        grossExpenses: { value: "0.00", currency: "THB" },
        refunds: { value: "0.00", currency: "THB" },
        netExpenses: { value: "0.00", currency: "THB" },
        net: { value: "0.00", currency: "THB" },
        transactionCount: 0,
      });
    });
  });

  test("carries aggregates past JavaScript's safe integers exactly", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const categories = await defaultCategories(db, owner.ownerId);
      for (let index = 0; index < 3; index += 1) {
        await insertTransaction(db, {
          ownerId: owner.ownerId,
          type: "income",
          walletId: owner.cashId,
          categoryId: categories.income,
          amount: 9_999_999_999n,
          transactionDate: "2026-09-02",
        });
      }

      const report = monthlyReportResponseSchema.parse(
        await (
          await getMonthlyReport(app, {
            cookie: owner.cookie,
            query: "month=2026-09",
          })
        ).json(),
      );
      expect(report.income).toEqual({ value: "299999999.97", currency: "THB" });
      expect(report.net).toEqual({ value: "299999999.97", currency: "THB" });
      expect(report.transactionCount).toBe(3);
    });
  });

  test("a malformed month is a bad request and every read requires authentication", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });

      for (const query of [
        "month=2026-13",
        "month=2026-00",
        "month=26-09",
        "month=2026-09-01",
        "month=0000-01",
        "month=",
      ]) {
        await expectProblem(
          await getMonthlyReport(app, {
            cookie: owner.cookie,
            query,
          }),
          { status: 400, code: "bad-request" },
        );
      }
      await expectProblem(
        await getMonthlyReport(app, { cookie: owner.cookie }),
        {
          status: 400,
          code: "bad-request",
        },
      );
      await expectProblem(
        await getMonthlyReport(app, {
          cookie: owner.cookie,
          query: "month=2026-09&from=2026-09-01",
        }),
        { status: 400, code: "bad-request" },
      );
      await expectProblem(await getMonthlyReport(app), {
        status: 401,
        code: "unauthenticated",
      });
      await expectProblem(
        await getMonthlyReport(app, { query: "month=2026-09" }),
        { status: 401, code: "unauthenticated" },
      );
    });
  });
});

function getCategorySpending(
  app: Hono<AppEnv>,
  { cookie, query }: Readonly<ReportRequest> = {},
) {
  return app.request(`${CATEGORY_SPENDING_URL}${query ? `?${query}` : ""}`, {
    headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

interface CategorySpendingRead {
  cookie: string;
  month: string;
}

async function readCategorySpending(
  app: Hono<AppEnv>,
  { cookie, month }: Readonly<CategorySpendingRead>,
) {
  const response = await getCategorySpending(app, {
    cookie,
    query: `month=${month}`,
  });
  expect(response.status).toBe(200);
  return categorySpendingResponseSchema.parse(await response.json());
}

/** The owner's expense tree by name, with a Debt payments parent added last. */
async function expenseCategories(db: Database, ownerId: string) {
  const [debtPayments] = await db
    .insert(categoryTable)
    .values({
      userId: ownerId,
      kind: "expense",
      name: "Debt payments",
      iconId: "credit-card",
      sortOrder: 99,
    })
    .returning({ id: categoryTable.id });
  if (!debtPayments) {
    throw new Error("Category insert returned no row");
  }
  const tree = await listCategories(db, ownerId);
  function idOf(name: string) {
    const category = tree.find(
      (candidate) => candidate.kind === "expense" && candidate.name === name,
    );
    if (!category) {
      throw new Error(`Missing expense category ${name}`);
    }
    return category.id;
  }
  return {
    food: idOf("Food & Drink"),
    groceries: idOf("Groceries"),
    restaurants: idOf("Restaurants"),
    transport: idOf("Transport"),
    fuel: idOf("Fuel"),
    uncategorized: idOf("Uncategorized"),
    debtPayments: debtPayments.id,
  };
}

describe("GET /v1/reports/category-spending", () => {
  test("breaks the month's Net expenses down by parent in category order, debt payments included", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const { income } = await defaultCategories(db, owner.ownerId);
      const tree = await expenseCategories(db, owner.ownerId);
      function expense(categoryId: string, amount: bigint) {
        return insertTransaction(db, {
          ownerId: owner.ownerId,
          type: "expense",
          walletId: owner.cashId,
          categoryId,
          amount,
          transactionDate: "2026-09-10",
        });
      }
      await expense(tree.debtPayments, 100_000n);
      const groceries = await expense(tree.groceries, 30_000n);
      await expense(tree.food, 20_000n);
      await expense(tree.fuel, 15_000n);
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: groceries,
        amount: 5_000n,
        transactionDate: "2026-09-12",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "income",
        walletId: owner.cashId,
        categoryId: income,
        amount: 400_000n,
        transactionDate: "2026-09-01",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        amount: 70_000n,
        transactionDate: "2026-09-03",
      });
      // Either side of the month.
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: tree.food,
        amount: 9_900n,
        transactionDate: "2026-08-31",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: tree.transport,
        amount: 9_900n,
        transactionDate: "2026-10-01",
      });

      const response = await getCategorySpending(app, {
        cookie: owner.cookie,
        query: "month=2026-09",
      });
      expect(response.status).toBe(200);
      const spending = categorySpendingResponseSchema.parse(
        await response.json(),
      );
      const monthly = monthlyReportResponseSchema.parse(
        await (
          await getMonthlyReport(app, {
            cookie: owner.cookie,
            query: "month=2026-09",
          })
        ).json(),
      );

      expect(spending).toEqual({
        month: "2026-09",
        netExpenses: { value: "1600.00", currency: "THB" },
        parents: [
          {
            id: tree.food,
            name: "Food & Drink",
            sortOrder: expect.any(Number),
            isUncategorized: false,
            spending: { value: "450.00", currency: "THB" },
            directSpending: { value: "200.00", currency: "THB" },
            children: [
              {
                id: tree.groceries,
                name: "Groceries",
                sortOrder: expect.any(Number),
                spending: { value: "250.00", currency: "THB" },
              },
            ],
          },
          {
            id: tree.transport,
            name: "Transport",
            sortOrder: expect.any(Number),
            isUncategorized: false,
            spending: { value: "150.00", currency: "THB" },
            directSpending: { value: "0.00", currency: "THB" },
            children: [
              {
                id: tree.fuel,
                name: "Fuel",
                sortOrder: expect.any(Number),
                spending: { value: "150.00", currency: "THB" },
              },
            ],
          },
          {
            id: tree.debtPayments,
            name: "Debt payments",
            sortOrder: 99,
            isUncategorized: false,
            spending: { value: "1000.00", currency: "THB" },
            directSpending: { value: "1000.00", currency: "THB" },
            children: [],
          },
        ],
      });
      expect(spending.netExpenses).toEqual(monthly.netExpenses);
      const [food, transport] = spending.parents;
      expect(food?.sortOrder).toBeLessThan(transport?.sortOrder ?? 0);
    });
  });

  test("lists Uncategorized last and flagged, only in a month it has activity", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const tree = await expenseCategories(db, owner.ownerId);
      for (const [categoryId, transactionDate] of [
        [tree.uncategorized, "2026-09-05"],
        [tree.food, "2026-09-06"],
        [tree.food, "2026-08-06"],
      ] as const) {
        await insertTransaction(db, {
          ownerId: owner.ownerId,
          type: "expense",
          walletId: owner.cashId,
          categoryId,
          amount: 12_345n,
          transactionDate,
        });
      }

      const september = categorySpendingResponseSchema.parse(
        await (
          await getCategorySpending(app, {
            cookie: owner.cookie,
            query: "month=2026-09",
          })
        ).json(),
      );
      expect(
        september.parents.map(({ name, isUncategorized, spending }) => ({
          name,
          isUncategorized,
          spending: spending.value,
        })),
      ).toEqual([
        { name: "Food & Drink", isUncategorized: false, spending: "123.45" },
        { name: "Uncategorized", isUncategorized: true, spending: "123.45" },
      ]);
      expect(september.netExpenses.value).toBe("246.90");

      const august = categorySpendingResponseSchema.parse(
        await (
          await getCategorySpending(app, {
            cookie: owner.cookie,
            query: "month=2026-08",
          })
        ).json(),
      );
      expect(august.parents.map(({ name }) => name)).toEqual(["Food & Drink"]);
    });
  });

  test("a later month's refund makes its expense's parent and child negative there and leaves the expense's month alone", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const tree = await expenseCategories(db, owner.ownerId);
      const groceries = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: tree.groceries,
        amount: 50_000n,
        transactionDate: "2026-08-20",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.cashId,
        refundOfTransactionId: groceries,
        amount: 20_000n,
        transactionDate: "2026-09-03",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: tree.food,
        amount: 10_000n,
        transactionDate: "2026-09-04",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: tree.fuel,
        amount: 30_000n,
        transactionDate: "2026-09-05",
      });

      const august = await readCategorySpending(app, {
        cookie: owner.cookie,
        month: "2026-08",
      });
      expect(august.netExpenses.value).toBe("500.00");
      expect(august.parents).toEqual([
        expect.objectContaining({
          id: tree.food,
          spending: { value: "500.00", currency: "THB" },
          directSpending: { value: "0.00", currency: "THB" },
          children: [
            expect.objectContaining({
              id: tree.groceries,
              spending: { value: "500.00", currency: "THB" },
            }),
          ],
        }),
      ]);

      const september = await readCategorySpending(app, {
        cookie: owner.cookie,
        month: "2026-09",
      });
      expect(september.parents).toEqual([
        expect.objectContaining({
          id: tree.food,
          spending: { value: "-100.00", currency: "THB" },
          directSpending: { value: "100.00", currency: "THB" },
          children: [
            expect.objectContaining({
              id: tree.groceries,
              spending: { value: "-200.00", currency: "THB" },
            }),
          ],
        }),
        expect.objectContaining({
          id: tree.transport,
          spending: { value: "300.00", currency: "THB" },
        }),
      ]);
      const monthly = monthlyReportResponseSchema.parse(
        await (
          await getMonthlyReport(app, {
            cookie: owner.cookie,
            query: "month=2026-09",
          })
        ).json(),
      );
      expect(september.netExpenses).toEqual(monthly.netExpenses);
      expect(september.netExpenses.value).toBe("200.00");
    });
  });

  test("recategorizing an expense moves it and its refunds in past months", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const tree = await expenseCategories(db, owner.ownerId);
      const dinner = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: tree.restaurants,
        amount: 40_000n,
        transactionDate: "2026-08-14",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.cashId,
        refundOfTransactionId: dinner,
        amount: 15_000n,
        transactionDate: "2026-09-02",
      });
      await db
        .update(transactions)
        .set({ categoryId: tree.fuel })
        .where(eq(transactions.id, dinner));

      for (const [month, value] of [
        ["2026-08", "400.00"],
        ["2026-09", "-150.00"],
      ] as const) {
        const spending = await readCategorySpending(app, {
          cookie: owner.cookie,
          month,
        });
        expect(spending.parents).toEqual([
          expect.objectContaining({
            id: tree.transport,
            spending: { value, currency: "THB" },
            directSpending: { value: "0.00", currency: "THB" },
            children: [
              {
                id: tree.fuel,
                name: "Fuel",
                sortOrder: expect.any(Number),
                spending: { value, currency: "THB" },
              },
            ],
          }),
        ]);
        expect(spending.netExpenses.value).toBe(value);
      }
    });
  });

  test("reports an empty month and another owner's spending as no rows", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const foreign = await createOwner({ db });
      const foreignTree = await expenseCategories(db, foreign.ownerId);
      await insertTransaction(db, {
        ownerId: foreign.ownerId,
        type: "expense",
        walletId: foreign.cashId,
        categoryId: foreignTree.food,
        amount: 70_000n,
        transactionDate: "2026-09-02",
      });

      const spending = categorySpendingResponseSchema.parse(
        await (
          await getCategorySpending(app, {
            cookie: owner.cookie,
            query: "month=2026-09",
          })
        ).json(),
      );
      expect(spending).toEqual({
        month: "2026-09",
        netExpenses: { value: "0.00", currency: "THB" },
        parents: [],
      });
    });
  });

  test("a malformed month is a bad request and the read requires authentication", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });

      for (const query of [
        "month=2026-13",
        "month=2026-00",
        "month=26-09",
        "month=2026-09-01",
        "month=0000-01",
        "month=",
        "month=2026-09&from=2026-09-01",
      ]) {
        await expectProblem(
          await getCategorySpending(app, { cookie: owner.cookie, query }),
          { status: 400, code: "bad-request" },
        );
      }
      await expectProblem(
        await getCategorySpending(app, { cookie: owner.cookie }),
        { status: 400, code: "bad-request" },
      );
      await expectProblem(await getCategorySpending(app), {
        status: 401,
        code: "unauthenticated",
      });
      await expectProblem(
        await getCategorySpending(app, { query: "month=2026-09" }),
        { status: 401, code: "unauthenticated" },
      );
    });
  });
});

function getClosingBalances(
  app: Hono<AppEnv>,
  { cookie, query }: Readonly<ReportRequest> = {},
) {
  return app.request(`${CLOSING_BALANCES_URL}${query ? `?${query}` : ""}`, {
    headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

interface DatedRead {
  cookie: string;
  month: string;
  walletId?: string;
}

async function readClosingBalances(
  app: Hono<AppEnv>,
  { cookie, month, walletId }: Readonly<DatedRead>,
) {
  const response = await getClosingBalances(app, {
    cookie,
    query: `month=${month}${walletId ? `&walletId=${walletId}` : ""}`,
  });
  expect(response.status).toBe(200);
  return closingBalancesResponseSchema.parse(await response.json());
}

interface WalletTotalRead {
  cookie: string;
  asOf: string;
}

/** The wallet collection's as-of balances summed: what the line must match. */
async function readWalletTotal(
  app: Hono<AppEnv>,
  { cookie, asOf }: Readonly<WalletTotalRead>,
) {
  const response = await app.request(`${WALLETS_URL}?asOf=${asOf}`, {
    headers: { origin: TEST_CLIENT_ORIGIN, cookie },
  });
  expect(response.status).toBe(200);
  const { items } = walletCollectionResponseSchema.parse(await response.json());
  const total = items.reduce(
    (sum, wallet) => sum + BigInt(wallet.balance.value.replace(".", "")),
    0n,
  );
  return presentMoney({ amountInMinorUnits: total, currency: "THB" });
}

interface WalletBalanceRead {
  cookie: string;
  walletId: string;
  asOf: string;
}

/** One wallet's as-of balance in the wallet collection: what its line must match. */
async function readWalletBalance(
  app: Hono<AppEnv>,
  { cookie, walletId, asOf }: Readonly<WalletBalanceRead>,
) {
  const response = await app.request(`${WALLETS_URL}?asOf=${asOf}`, {
    headers: { origin: TEST_CLIENT_ORIGIN, cookie },
  });
  expect(response.status).toBe(200);
  const { items } = walletCollectionResponseSchema.parse(await response.json());
  return items.find((wallet) => wallet.id === walletId)?.balance;
}

/** Mid-afternoon on 13 Sep 2026 in Bangkok. */
const MID_SEPTEMBER = new Date("2026-09-13T08:00:00Z");

describe("GET /v1/reports/closing-balances", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("totals every wallet's Closing balance per day, transfers unchanged and archived wallets counted", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const categories = await defaultCategories(db, owner.ownerId);
      const expenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: categories.expense,
        amount: 50_000n,
        transactionDate: "2026-09-02",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "income",
        walletId: owner.bankId,
        categoryId: categories.income,
        amount: 300_000n,
        transactionDate: "2026-09-03",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        amount: 200_000n,
        transactionDate: "2026-09-04",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.cashId,
        refundOfTransactionId: expenseId,
        amount: 10_000n,
        transactionDate: "2026-09-05",
      });
      const deletedId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: categories.expense,
        amount: 70_000n,
        transactionDate: "2026-09-05",
      });
      await db
        .update(transactions)
        .set({ deletedAt: new Date() })
        .where(eq(transactions.id, deletedId));
      // Archived holdings stay in the total, as on Wallet balances.
      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, owner.bankId));

      const balances = await readClosingBalances(app, {
        cookie: owner.cookie,
        month: "2026-09",
      });

      expect(balances.month).toBe("2026-09");
      expect(balances.entries).toHaveLength(30);
      expect(balances.entries.slice(0, 6)).toEqual([
        { date: "2026-09-01", total: { value: "10000.00", currency: "THB" } },
        { date: "2026-09-02", total: { value: "9500.00", currency: "THB" } },
        { date: "2026-09-03", total: { value: "12500.00", currency: "THB" } },
        // The transfer moves money between wallets, not out of the total.
        { date: "2026-09-04", total: { value: "12500.00", currency: "THB" } },
        { date: "2026-09-05", total: { value: "12600.00", currency: "THB" } },
        { date: "2026-09-06", total: { value: "12600.00", currency: "THB" } },
      ]);
      for (const entry of balances.entries) {
        expect(entry.total).toEqual(
          await readWalletTotal(app, {
            cookie: owner.cookie,
            asOf: entry.date,
          }),
        );
      }
    });
  });

  test("carries the balance into the month and is null before every opening date", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie, ownerId } = await createOwnerSession(db);
      await initializeDefaultCategories(db, ownerId);
      const categories = await defaultCategories(db, ownerId);
      const [early] = await db
        .insert(wallets)
        .values([
          {
            userId: ownerId,
            name: "Early",
            type: "cash",
            currency: "THB",
            openingAmount: 100_000n,
            openingDate: "2026-08-10",
          },
          {
            userId: ownerId,
            name: "Late",
            type: "cash",
            currency: "THB",
            openingAmount: 50_000n,
            openingDate: "2026-09-20",
          },
        ])
        .returning({ id: wallets.id });
      if (!early) {
        throw new Error("Wallet inserts returned no rows");
      }
      await insertTransaction(db, {
        ownerId,
        type: "expense",
        walletId: early.id,
        categoryId: categories.expense,
        amount: 30_000n,
        transactionDate: "2026-08-15",
      });

      const august = await readClosingBalances(app, {
        cookie,
        month: "2026-08",
      });
      expect(august.entries).toHaveLength(31);
      expect(august.entries.slice(8, 10)).toEqual([
        { date: "2026-08-09", total: null },
        { date: "2026-08-10", total: { value: "1000.00", currency: "THB" } },
      ]);
      expect(august.entries.at(-1)).toEqual({
        date: "2026-08-31",
        total: { value: "700.00", currency: "THB" },
      });

      const september = await readClosingBalances(app, {
        cookie,
        month: "2026-09",
      });
      expect(september.entries[0]).toEqual({
        date: "2026-09-01",
        total: { value: "700.00", currency: "THB" },
      });
      // A wallet joins the total on its opening date.
      expect(september.entries.slice(18, 20)).toEqual([
        { date: "2026-09-19", total: { value: "700.00", currency: "THB" } },
        { date: "2026-09-20", total: { value: "1200.00", currency: "THB" } },
      ]);

      const july = await readClosingBalances(app, { cookie, month: "2026-07" });
      expect(july.entries).toHaveLength(31);
      expect(july.entries.every((entry) => entry.total === null)).toBe(true);
    });
  });

  test("stops at today, has no entries for a future month, and ignores other owners", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MID_SEPTEMBER);
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const stranger = await createOwnerSession(db);

      const september = await readClosingBalances(app, {
        cookie: owner.cookie,
        month: "2026-09",
      });
      expect(september.entries).toHaveLength(13);
      expect(september.entries.at(-1)).toEqual({
        date: "2026-09-13",
        total: { value: "10000.00", currency: "THB" },
      });

      expect(
        await readClosingBalances(app, {
          cookie: owner.cookie,
          month: "2026-10",
        }),
      ).toEqual({ month: "2026-10", entries: [] });

      // Without wallets, every day is before an opening date.
      const strangers = await readClosingBalances(app, {
        cookie: stranger.cookie,
        month: "2026-09",
      });
      expect(strangers.entries).toHaveLength(13);
      expect(strangers.entries.every((entry) => entry.total === null)).toBe(
        true,
      );
    });
  });

  test("reads one wallet's Closing balance beside the total, the transfer moving only the wallet", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const categories = await defaultCategories(db, owner.ownerId);
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "income",
        walletId: owner.bankId,
        categoryId: categories.income,
        amount: 300_000n,
        transactionDate: "2026-09-02",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        amount: 200_000n,
        transactionDate: "2026-09-03",
      });
      // An archived wallet can still be compared.
      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, owner.bankId));

      const balances = await readClosingBalances(app, {
        cookie: owner.cookie,
        month: "2026-09",
        walletId: owner.bankId,
      });

      expect(balances.entries).toHaveLength(30);
      expect(balances.entries.slice(0, 4)).toEqual([
        {
          date: "2026-09-01",
          total: { value: "10000.00", currency: "THB" },
          wallet: { value: "0.00", currency: "THB" },
        },
        {
          date: "2026-09-02",
          total: { value: "13000.00", currency: "THB" },
          wallet: { value: "3000.00", currency: "THB" },
        },
        {
          date: "2026-09-03",
          total: { value: "13000.00", currency: "THB" },
          wallet: { value: "5000.00", currency: "THB" },
        },
        {
          date: "2026-09-04",
          total: { value: "13000.00", currency: "THB" },
          wallet: { value: "5000.00", currency: "THB" },
        },
      ]);
      for (const entry of balances.entries) {
        expect(entry.wallet).toEqual(
          await readWalletBalance(app, {
            cookie: owner.cookie,
            walletId: owner.bankId,
            asOf: entry.date,
          }),
        );
      }

      // Without a wallet requested, entries carry the total alone.
      const totalOnly = await readClosingBalances(app, {
        cookie: owner.cookie,
        month: "2026-09",
      });
      expect(totalOnly.entries[0]).toEqual({
        date: "2026-09-01",
        total: { value: "10000.00", currency: "THB" },
      });
    });
  });

  test("a wallet's figure is null before its opening date, even after the total starts", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const [late] = await db
        .insert(wallets)
        .values({
          userId: owner.ownerId,
          name: "Late",
          type: "cash",
          currency: "THB",
          openingAmount: 50_000n,
          openingDate: "2026-09-20",
        })
        .returning({ id: wallets.id });
      if (!late) {
        throw new Error("Wallet insert returned no rows");
      }

      const september = await readClosingBalances(app, {
        cookie: owner.cookie,
        month: "2026-09",
        walletId: late.id,
      });
      expect(september.entries.slice(18, 20)).toEqual([
        {
          date: "2026-09-19",
          total: { value: "10000.00", currency: "THB" },
          wallet: null,
        },
        {
          date: "2026-09-20",
          total: { value: "10500.00", currency: "THB" },
          wallet: { value: "500.00", currency: "THB" },
        },
      ]);

      const august = await readClosingBalances(app, {
        cookie: owner.cookie,
        month: "2026-08",
        walletId: late.id,
      });
      expect(
        august.entries.every(
          (entry) => entry.total === null && entry.wallet === null,
        ),
      ).toBe(true);
    });
  });

  test("another owner's or an unknown wallet is not found, even for a future month", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const stranger = await createOwner({ db });

      for (const query of [
        `month=2026-09&walletId=${stranger.cashId}`,
        "month=2026-09&walletId=00000000-0000-4000-8000-000000000000",
        `month=2999-01&walletId=${stranger.cashId}`,
      ]) {
        await expectProblem(
          await getClosingBalances(app, { cookie: owner.cookie, query }),
          { status: 404, code: "not-found" },
        );
      }
      await expectProblem(
        await getClosingBalances(app, {
          cookie: owner.cookie,
          query: "month=2026-09&walletId=not-a-wallet",
        }),
        { status: 400, code: "bad-request" },
      );
    });
  });

  test("a malformed month is a bad request and the read requires authentication", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });

      for (const query of [
        "month=2026-13",
        "month=2026-00",
        "month=26-09",
        "month=2026-09-01",
        "month=0000-01",
        "month=",
        "month=2026-09&from=2026-09-01",
      ]) {
        await expectProblem(
          await getClosingBalances(app, { cookie: owner.cookie, query }),
          { status: 400, code: "bad-request" },
        );
      }
      await expectProblem(
        await getClosingBalances(app, { cookie: owner.cookie }),
        { status: 400, code: "bad-request" },
      );
      await expectProblem(await getClosingBalances(app), {
        status: 401,
        code: "unauthenticated",
      });
      await expectProblem(
        await getClosingBalances(app, { query: "month=2026-09" }),
        { status: 401, code: "unauthenticated" },
      );
    });
  });
});
