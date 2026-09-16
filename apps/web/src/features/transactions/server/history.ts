import type { Database } from "@bookkeeping/database/connection";
import { transactions } from "@bookkeeping/database/transactions";
import type { MonthlySummary } from "@bookkeeping/domain/transactions";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";

interface MonthlySummaryOptions {
  ownerId: string;
  /** Validated YYYY-MM at the authenticated edge. Financial dates are Bangkok calendar dates. */
  month: string;
}

/** PostgreSQL numeric SUM returns decimal strings, preserving exact large totals. */
export async function getMonthlySummary(
  db: Database,
  { ownerId, month }: Readonly<MonthlySummaryOptions>,
): Promise<MonthlySummary> {
  const start = `${month}-01`;
  const monthEnd = new Date(`${start}T00:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  monthEnd.setUTCDate(0);
  const end = monthEnd.toISOString().slice(0, 10);
  const [row] = await db
    .select({
      income: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'income'), 0)`,
      grossExpenses: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'expense'), 0)`,
      refunds: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'refund'), 0)`,
      transactionCount: sql<string>`count(*) filter (where ${transactions.type} != 'transfer')`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, ownerId),
        isNull(transactions.deletedAt),
        gte(transactions.transactionDate, start),
        lte(transactions.transactionDate, end),
      ),
    );
  if (!row) {
    throw new Error("Monthly aggregate returned no row");
  }
  const income = BigInt(row.income);
  const grossExpenses = BigInt(row.grossExpenses);
  const refunds = BigInt(row.refunds);
  const netExpenses = grossExpenses - refunds;
  return {
    month,
    income,
    grossExpenses,
    refunds,
    netExpenses,
    net: income - netExpenses,
    transactionCount: Number(row.transactionCount),
  };
}
