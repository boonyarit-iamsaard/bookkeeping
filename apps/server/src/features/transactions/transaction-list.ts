import type { ListTransactionsOptions } from "@bookkeeping/application/transactions/reads";
import {
  listNumberedTransactionPage,
  listTransactionPage,
} from "@bookkeeping/application/transactions/reads";
import type { Database } from "@bookkeeping/database/connection";
import {
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
import {
  decodeTransactionCursor,
  encodeTransactionCursor,
} from "./transaction-cursor.js";

const DEFAULT_TRANSACTION_PAGE_LIMIT = 50;
const MAX_TRANSACTION_PAGE_LIMIT = 100;
const DEFAULT_TRANSACTION_PAGE_SIZE = 50;
const NUMBERED_KEYS = ["page", "pageSize", "sort", "order"] as const;

/** Any of page, pageSize, sort, or order asks for a numbered page. */
function isNumbered(
  query: Readonly<Partial<Record<(typeof NUMBERED_KEYS)[number], unknown>>>,
) {
  return NUMBERED_KEYS.some((key) => query[key] !== undefined);
}

const positiveIntegerText = z.string().regex(/^[1-9]\d*$/);

const transactionLimitSchema = positiveIntegerText.transform((value) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed)
    ? Math.min(parsed, MAX_TRANSACTION_PAGE_LIMIT)
    : MAX_TRANSACTION_PAGE_LIMIT;
});

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
    limit: transactionLimitSchema.optional(),
    cursor: z.string().min(1).optional(),
    page: positiveIntegerText
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
    const byCursor = query.cursor !== undefined || query.limit !== undefined;
    if (byCursor && isNumbered(query)) {
      context.addIssue({
        code: "custom",
        path: ["cursor"],
        message: "A cursor page cannot also be numbered or sorted",
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

/**
 * The owner's transactions for one list request: a numbered page when any of
 * page, pageSize, sort, or order is given, otherwise a cursor page. `null`
 * when the cursor was not issued for this owner's identical query.
 */
export async function readTransactionList(
  db: Database,
  { ownerId, query }: Readonly<TransactionListRequest>,
): Promise<TransactionCollection | null> {
  const options: ListTransactionsOptions = {
    ownerId,
    from: query.from,
    to: query.to,
    walletId: query.walletId,
    categoryId: query.categoryId,
    type: query.type,
    tagIds: query.tagId,
  };
  if (isNumbered(query)) {
    const pageNumber = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_TRANSACTION_PAGE_SIZE;
    const numbered = await listNumberedTransactionPage(db, {
      ...options,
      page: pageNumber,
      pageSize,
      sort: query.sort ?? "date",
      order: query.order ?? "desc",
    });
    return {
      items: numbered.items.map(presentTransaction),
      page: {
        nextCursor: null,
        number: pageNumber,
        size: pageSize,
        total: numbered.total,
      },
    };
  }

  const after =
    query.cursor === undefined
      ? undefined
      : decodeTransactionCursor(query.cursor, options);
  if (after === null) {
    return null;
  }
  const page = await listTransactionPage(db, {
    ...options,
    limit: query.limit ?? DEFAULT_TRANSACTION_PAGE_LIMIT,
    after,
  });
  return {
    items: page.items.map(presentTransaction),
    page: {
      nextCursor: page.nextPosition
        ? encodeTransactionCursor({ options, position: page.nextPosition })
        : null,
    },
  };
}
