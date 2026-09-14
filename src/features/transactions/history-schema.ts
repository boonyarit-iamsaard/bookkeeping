import { z } from "zod";
import { TRANSACTION_TYPES } from "@/features/transactions/transaction.types";
import { parseCalendarDate } from "@/shared/helpers/dates";

const calendarDate = z
  .string()
  .refine(
    (value) => value >= "0001-01-01" && parseCalendarDate(value).ok,
    "Choose a valid date.",
  );

export const transactionFiltersSchema = z
  .object({
    from: calendarDate.optional(),
    to: calendarDate.optional(),
    walletId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "From date must be on or before To date.",
  );

export const reportSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .refine(
      (value) => value >= "0001-01" && parseCalendarDate(`${value}-01`).ok,
    ),
  asOf: calendarDate,
});

/** Empty GET controls mean all records. Repeated parameters stay invalid. */
export function nonemptySearchParams(
  params: Readonly<Record<string, string | string[] | undefined>>,
): Record<string, string | string[]> {
  return Object.fromEntries(
    Object.entries(params).filter(
      (entry): entry is [string, string | string[]] =>
        entry[1] !== undefined && entry[1] !== "",
    ),
  );
}
