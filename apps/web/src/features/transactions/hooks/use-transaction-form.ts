import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { TransactionType } from "@bookkeeping/domain/transactions";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { apiClient } from "@/core/api/client";
import type { components } from "@/core/api/openapi.gen";
import { describeRejection } from "@/core/api/rejection-wording";
import { useFormWrites } from "@/core/api/use-form-writes";
import type { ApiRejection } from "@/core/api/write-submission";
import { captureReturnHref } from "@/features/transactions/capture-origin";
import type {
  CategoryOption,
  WalletOption,
} from "@/features/transactions/transaction.types";
import type {
  EntryRequest,
  TransactionEntry,
} from "@/features/transactions/transaction-entry";
import {
  entryRequest,
  valuesForType,
} from "@/features/transactions/transaction-entry";
import { createTransactionFormSchema } from "@/features/transactions/transaction-form-schema";
import {
  carriesFacts,
  describeTransactionFieldError,
  TRANSACTION_FORM_FIELDS,
} from "@/features/transactions/transaction-rejection";

interface UseTransactionFormOptions {
  entry: TransactionEntry;
  wallets: readonly WalletOption[];
  categories: readonly CategoryOption[];
  today: CalendarDate;
}

type CreateTransactionRequest =
  components["schemas"]["CreateTransactionRequest"];
type Transaction = components["schemas"]["Transaction"];

/** An update names the transaction it replaces beside the new values. */
type TransactionUpdate = Omit<
  Extract<EntryRequest, { kind: "update" }>,
  "kind"
>;

/**
 * A figure or date the rejection names may be newer than the page's, so the
 * page re-reads and its hints agree with the message.
 */
function refreshOnRejection(rejection: Readonly<ApiRejection>): boolean {
  return rejection.errors.some(carriesFacts);
}

/**
 * Glue between the entry and the form state: the schema checks the entry's
 * limits, and a submit sends the request the entry builds.
 */
export function useTransactionForm({
  entry,
  wallets,
  categories,
  today,
}: Readonly<UseTransactionFormOptions>) {
  const { captureOrigin, limits } = entry;
  const navigate = useNavigate();
  const schema = useMemo(
    () =>
      createTransactionFormSchema({
        today,
        walletOpeningDates: Object.fromEntries(
          wallets.map((wallet) => [wallet.id, wallet.openingDate]),
        ),
        linkedExpense: limits,
      }),
    [wallets, limits, today],
  );

  async function returnFrom(saved: Readonly<Transaction>) {
    if (captureOrigin) {
      await navigate({ href: captureReturnHref(captureOrigin, saved.id) });
    } else {
      await navigate({ to: "/transactions", search: { created: saved.id } });
    }
  }

  const { submit, pending, serverError, fieldErrors, clearFieldError } =
    useFormWrites({
      fields: TRANSACTION_FORM_FIELDS,
      writes: {
        create: {
          kind: "create",
          send: (input: CreateTransactionRequest, attempt) =>
            apiClient.POST("/v1/transactions", {
              params: { header: attempt.header },
              body: input,
            }),
          describeFieldError: describeTransactionFieldError,
          describeRejection,
          refreshOnRejection,
          onDone: (created: Transaction) => returnFrom(created),
        },
        update: {
          kind: "change",
          send: ({ transactionId, request }: TransactionUpdate) =>
            apiClient.PUT("/v1/transactions/{transactionId}", {
              params: { path: { transactionId } },
              body: request,
            }),
          describeFieldError: describeTransactionFieldError,
          describeRejection,
          refreshOnRejection,
          onDone: (updated: Transaction) => returnFrom(updated),
        },
      },
    });

  const form = useForm({
    defaultValues: entry.initialValues,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: schema,
    },
    onSubmit: async ({ value }) => {
      // The validator has passed but keeps the input values; this parse
      // only yields the satang amount the request carries.
      const outcome = entryRequest(entry, schema.parse(value));
      if (outcome.kind === "update") {
        await submit("update", outcome);
      } else {
        await submit("create", outcome.request);
      }
    },
  });

  function changeType(type: TransactionType) {
    const patch = valuesForType({
      values: form.state.values,
      type,
      wallets,
      categories,
    });
    form.setFieldValue("type", patch.type);
    if (patch.categoryId !== undefined) {
      form.setFieldValue("categoryId", patch.categoryId);
    }
    if (patch.tagIds !== undefined) {
      form.setFieldValue("tagIds", patch.tagIds);
    }
    if (patch.destinationWalletId !== undefined) {
      form.setFieldValue("destinationWalletId", patch.destinationWalletId);
    }
    for (const field of TRANSACTION_FORM_FIELDS) {
      clearFieldError(field);
    }
  }

  return {
    form,
    serverError,
    fieldErrors,
    clearFieldError,
    changeType,
    pending,
  };
}
