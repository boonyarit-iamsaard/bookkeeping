import type { CategorySummary } from "@bookkeeping/domain/categories";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import { formatMoney, formatMoneyInput } from "@bookkeeping/domain/money";
import type { TransactionType } from "@bookkeeping/domain/transactions";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { apiClient } from "@/core/api/client";
import type { components } from "@/core/api/openapi.gen";
import {
  categoryQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { useApiMutation } from "@/core/api/use-api-mutation";
import type { ApiFieldError } from "@/core/api/write-submission";
import type {
  LinkedExpenseLimits,
  TransactionFormInput,
  TransactionFormValues,
} from "@/features/transactions/transaction-form-schema";
import { createTransactionFormSchema } from "@/features/transactions/transaction-form-schema";

export interface WalletOption {
  id: string;
  name: string;
  type: components["schemas"]["Wallet"]["type"];
  openingDate: CalendarDate;
  archived?: boolean;
  /** Pre-formatted on the server or route; bigint does not cross the API. */
  balanceLabel: string;
}

export type CategoryOption = CategorySummary;

export type TransactionFormField =
  | "amount"
  | "walletId"
  | "destinationWalletId"
  | "categoryId"
  | "transactionDate"
  | "note";

interface UseTransactionFormOptions {
  wallets: readonly WalletOption[];
  categories: readonly CategoryOption[];
  initialValues: TransactionFormInput;
  /** Set when the form records or corrects a refund of one expense. */
  linkedExpense?: LinkedExpenseLimits;
}

type CreateTransactionRequest =
  components["schemas"]["CreateTransactionRequest"];
type Transaction = components["schemas"]["Transaction"];

const TRANSACTION_FORM_FIELDS: readonly TransactionFormField[] = [
  "amount",
  "walletId",
  "destinationWalletId",
  "categoryId",
  "transactionDate",
  "note",
];

const FIELD_ERROR_MESSAGES: Record<string, string> = {
  "wallet-not-found": "That wallet is not available. Choose another wallet.",
  "destination-wallet-not-found":
    "That destination wallet is not available. Choose another wallet.",
  "wallet-archived":
    "That wallet is archived. Choose an active wallet or retain this transaction’s existing wallets.",
  "same-wallet":
    "Choose two different available wallets. Transfers have no category.",
  "invalid-transfer":
    "Choose two different available wallets. Transfers have no category.",
  "category-not-found":
    "That category is not available for this type. Choose another.",
  "category-kind-mismatch":
    "That category is not available for this type. Choose another.",
  "amount-out-of-range": "The amount must be between ฿0.01 and ฿99,999,999.99",
  "note-too-long": "Notes can be at most 200 characters",
  "invalid-date": "Enter a real calendar date",
  "future-date": "The date cannot be in the future",
  "before-opening":
    "This wallet opened before the chosen date; earlier dates are not tracked",
};

function describeTransactionFieldError(
  { code, detail }: Readonly<ApiFieldError>,
  linkedExpense: LinkedExpenseLimits | undefined,
): string {
  if (code === "exceeds-refundable" && linkedExpense) {
    return linkedExpense.remaining > 0n
      ? `Only ${formatMoney({ amountInMinorUnits: linkedExpense.remaining, currency: "THB" })} of this expense is left to refund`
      : "This expense is already fully refunded";
  }
  return detail ?? FIELD_ERROR_MESSAGES[code] ?? "This value was not accepted.";
}

function formFieldErrors(
  errors: Readonly<Record<string, string>>,
): Partial<Record<TransactionFormField, string>> {
  const fieldErrors: Partial<Record<TransactionFormField, string>> = {};
  for (const field of TRANSACTION_FORM_FIELDS) {
    const message = errors[field];
    if (message) {
      fieldErrors[field] = message;
    }
  }
  return fieldErrors;
}

function toCreateTransactionRequest(
  values: Readonly<TransactionFormValues>,
): CreateTransactionRequest {
  const amount = {
    value: formatMoneyInput({
      amountInMinorUnits: values.amount,
      currency: values.currency,
    }),
    currency: values.currency,
  };
  const common = {
    amount,
    walletId: values.walletId,
    transactionDate: values.transactionDate,
    note: values.note,
  };

  switch (values.type) {
    case "income":
    case "expense":
      return {
        ...common,
        type: values.type,
        categoryId: values.categoryId,
      };
    case "transfer":
      return {
        ...common,
        type: values.type,
        destinationWalletId: values.destinationWalletId,
      };
    case "refund":
      return {
        ...common,
        type: values.type,
        refundOfTransactionId: values.refundOfTransactionId,
      };
  }
}

export function uncategorizedFor(
  categories: readonly CategoryOption[],
  type: TransactionType,
): string {
  return (
    categories.find(
      (category) => category.kind === type && category.isProtected,
    )?.id ??
    categories.find((category) => category.kind === type)?.id ??
    ""
  );
}

/**
 * Owns the transaction entry form's client validation and API adapter. The
 * form keeps raw strings until its schema turns the amount into exact satang.
 */
export function useTransactionForm({
  wallets,
  categories,
  initialValues,
  linkedExpense,
}: Readonly<UseTransactionFormOptions>) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<TransactionFormField, string>>
  >({});
  const schema = useMemo(
    () =>
      createTransactionFormSchema({
        walletOpeningDates: Object.fromEntries(
          wallets.map((wallet) => [wallet.id, wallet.openingDate]),
        ),
        linkedExpense,
      }),
    [wallets, linkedExpense],
  );
  const createTransaction = useApiMutation<
    CreateTransactionRequest,
    Transaction
  >({
    send: (input, attempt) =>
      apiClient.POST("/v1/transactions", {
        params: { header: attempt.header },
        body: input,
      }),
    describeFieldError: (fieldError) =>
      describeTransactionFieldError(fieldError, linkedExpense),
  });

  const form = useForm({
    defaultValues: initialValues,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: schema,
    },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      setFieldErrors({});

      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        return;
      }

      let result: Awaited<ReturnType<typeof createTransaction.submit>>;
      try {
        result = await createTransaction.submit(
          toCreateTransactionRequest(parsed.data),
        );
      } catch {
        setServerError(
          "The transaction could not be saved. Check your connection and try again.",
        );
        return;
      }

      if (!result.ok) {
        setFieldErrors(formFieldErrors(result.error.fieldErrors));
        setServerError(result.error.message);
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: walletQueries.list().queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: transactionQueries.list().queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: categoryQueries.usage().queryKey,
        }),
      ]);
      // A refund changes what its expense shows: the panel and its allowance.
      const refundedExpense = result.value.refundOf;
      if (refundedExpense) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: transactionQueries.detail(refundedExpense.id).queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: transactionQueries.refunds(refundedExpense.id).queryKey,
          }),
        ]);
      }
      await navigate({
        to: "/transactions",
        search: { created: result.value.id },
      });
    },
  });

  function changeType(type: TransactionType) {
    form.setFieldValue("type", type);
    setFieldErrors({});
    if (type === "transfer") {
      form.setFieldValue("categoryId", "");
      if (!form.getFieldValue("destinationWalletId")) {
        form.setFieldValue(
          "destinationWalletId",
          wallets.find((wallet) => wallet.id !== form.getFieldValue("walletId"))
            ?.id ?? "",
        );
      }
      return;
    }
    form.setFieldValue("destinationWalletId", "");
    const current = categories.find(
      (category) => category.id === form.getFieldValue("categoryId"),
    );
    if (current?.kind !== type) {
      form.setFieldValue("categoryId", uncategorizedFor(categories, type));
    }
  }

  function clearFieldError(field: TransactionFormField) {
    setFieldErrors((current) =>
      current[field] ? { ...current, [field]: undefined } : current,
    );
  }

  return {
    form,
    serverError,
    fieldErrors,
    clearFieldError,
    changeType,
    isPending: createTransaction.isPending,
  };
}
