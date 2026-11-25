import { listNumberedTransactionPage } from "@bookkeeping/application/transactions/reads";
import type { Database } from "@bookkeeping/database/connection";
import {
  DEFAULT_TRANSACTION_PAGE_SIZE,
  isTransactionListPage,
  TRANSACTION_LIST_ORDERS,
  TRANSACTION_LIST_SORTS,
  TRANSACTION_PAGE_SIZES,
  TRANSACTION_TYPES,
} from "@bookkeeping/domain/transactions";
import * as z from "zod";
import { createQueryMiddleware } from "../../core/http/request-validation.js";
import type { transactionCollectionResponseSchema } from "./transaction.schemas.js";
import { presentTransaction } from "./transaction.schemas.js";

export const transactionListQuerySchema = z
  .strictObject({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    walletId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
    // Repeat it for any of several tags; a single one arrives as a string.
    tagId: z
      .union([z.uuid().transform((id) => [id]), z.array(z.uuid())])
      .optional(),
    page: z
      .string()
      .regex(/^[1-9]\d*$/)
      .transform(Number)
      .refine(isTransactionListPage)
      .optional(),
    pageSize: z
      .enum(TRANSACTION_PAGE_SIZES.map(String))
      .transform(Number)
      .optional(),
    sort: z.enum(TRANSACTION_LIST_SORTS).optional(),
    order: z.enum(TRANSACTION_LIST_ORDERS).optional(),
  })
  .superRefine((query, context) => {
    if (
      query.from !== undefined &&
      query.to !== undefined &&
      query.from > query.to
    ) {
      context.addIssue({
        code: "custom",
        path: ["from"],
        message: "The start date must not be after the end date",
      });
    }
  });

export const transactionListQueryMiddleware = createQueryMiddleware(
  transactionListQuerySchema,
);

type TransactionListQuery = z.output<typeof transactionListQuerySchema>;

interface TransactionListRequest {
  ownerId: string;
  query: Readonly<TransactionListQuery>;
}

type TransactionCollection = z.infer<
  typeof transactionCollectionResponseSchema
>;

/** One numbered page of the owner's transactions, with the filtered total. */
export async function readTransactionList(
  db: Database,
  { ownerId, query }: Readonly<TransactionListRequest>,
): Promise<TransactionCollection> {
  const pageNumber = query.page ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_TRANSACTION_PAGE_SIZE;
  const numbered = await listNumberedTransactionPage(db, {
    ownerId,
    from: query.from,
    to: query.to,
    walletId: query.walletId,
    categoryId: query.categoryId,
    type: query.type,
    tagIds: query.tagId,
    page: pageNumber,
    pageSize,
    sort: query.sort ?? "date",
    order: query.order ?? "desc",
  });
  return {
    items: numbered.items.map(presentTransaction),
    page: { number: pageNumber, size: pageSize, total: numbered.total },
  };
}
