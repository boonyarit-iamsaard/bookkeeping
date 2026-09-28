import type { CategorySummary } from "@bookkeeping/domain/categories";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import { formatMoneyInput } from "@bookkeeping/domain/money";
import type { TransactionType } from "@bookkeeping/domain/transactions";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { apiClient } from "@/core/api/client";
import type { components } from "@/core/api/openapi.gen";
import { useApiMutation } from "@/core/api/use-api-mutation";
import { pickFieldErrors } from "@/core/api/write-submission";
import { refreshAfterWrite } from "@/core/query/refresh-after-write";
import type { CaptureOrigin } from "@/features/transactions/capture-origin";
import { captureReturnHref } from "@/features/transactions/capture-origin";
import type {
  LinkedExpenseLimits,
  TransactionFormInput,
  TransactionFormValues,
} from "@/features/transactions/transaction-form-schema";
import { createTransactionFormSchema } from "@/features/transactions/transaction-form-schema";
import type { TransactionFormField } from "@/features/transactions/transaction-rejection";
import {
  carriesFacts,
  describeTransactionFieldError,
  TRANSACTION_FORM_FIELDS,
  transactionFieldOf,
} from "@/features/transactions/transaction-rejection";

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

interface UseTransactionFormOptions {
  wallets: readonly WalletOption[];
  categories: readonly CategoryOption[];
  initialValues: TransactionFormInput;
  /** Set when the form records or corrects a refund of one expense. */
  linkedExpense?: LinkedExpenseLimits;
  /** Set when the form corrects an existing transaction instead of recording one. */
  editingId?: string;
  /** Set only for a new entry that returns to its opening screen. */
  captureOrigin?: CaptureOrigin;
}

type CreateTransactionRequest =
  components["schemas"]["CreateTransactionRequest"];
type UpdateTransactionRequest =
  components["schemas"]["UpdateTransactionRequest"];
type Transaction = components["schemas"]["Transaction"];

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

/** An edit carries every field but the type and the expense link, which are fixed. */
function toUpdateTransactionRequest(
  values: Readonly<TransactionFormValues>,
): UpdateTransactionRequest {
  const request: UpdateTransactionRequest = {
    amount: {
      value: formatMoneyInput({
        amountInMinorUnits: values.amount,
        currency: values.currency,
      }),
      currency: values.currency,
    },
    walletId: values.walletId,
    transactionDate: values.transactionDate,
    note: values.note,
  };
  if (values.type === "transfer") {
    return { ...request, destinationWalletId: values.destinationWalletId };
  }
  if (values.type === "refund") {
    return request;
  }
  return { ...request, categoryId: values.categoryId };
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
  editingId,
  captureOrigin,
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
    describeFieldError: describeTransactionFieldError,
    fieldOf: transactionFieldOf,
  });
  // An update that changes nothing succeeds without effect, so the helper's
  // same-request replay is safe here without the creation key.
  const updateTransaction = useApiMutation<
    UpdateTransactionRequest,
    Transaction
  >({
    send: (input) =>
      apiClient.PUT("/v1/transactions/{transactionId}", {
        params: { path: { transactionId: editingId ?? "" } },
        body: input,
      }),
    describeFieldError: describeTransactionFieldError,
    fieldOf: transactionFieldOf,
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
        result = editingId
          ? await updateTransaction.submit(
              toUpdateTransactionRequest(parsed.data),
            )
          : await createTransaction.submit(
              toCreateTransactionRequest(parsed.data),
            );
      } catch {
        setServerError(
          "The transaction could not be saved. Check your connection and try again.",
        );
        return;
      }

      if (!result.ok) {
        setFieldErrors(
          pickFieldErrors(result.error.fieldErrors, TRANSACTION_FORM_FIELDS),
        );
        setServerError(result.error.message);
        // A figure or date the rejection names may be newer than the page's,
        // so the page re-reads and its hints agree with the message.
        if (result.error.errors.some(carriesFacts)) {
          await refreshAfterWrite(queryClient);
        }
        return;
      }

      await refreshAfterWrite(queryClient);
      if (captureOrigin) {
        await navigate({
          href: captureReturnHref(captureOrigin, result.value.id),
        });
      } else {
        await navigate({
          to: "/transactions",
          search: { created: result.value.id },
        });
      }
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
    isPending: createTransaction.isPending || updateTransaction.isPending,
  };
}
