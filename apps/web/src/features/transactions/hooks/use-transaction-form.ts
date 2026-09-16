"use client";

import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { Result } from "@bookkeeping/domain/result";
import type { WalletType } from "@bookkeeping/domain/wallets";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CategorySummary } from "@/features/categories/category.types";
import type {
  TransactionActionError,
  TransactionActionSuccess,
  TransactionFormField,
} from "@/features/transactions/server/transaction.actions";
import type { TransactionType } from "@/features/transactions/transaction.types";
import type {
  LinkedExpenseLimits,
  TransactionFormInput,
} from "@/features/transactions/transaction-form-schema";
import { createTransactionFormSchema } from "@/features/transactions/transaction-form-schema";

export interface WalletOption {
  id: string;
  name: string;
  type: WalletType;
  openingDate: CalendarDate;
  archived?: boolean;
  /** Pre-formatted on the server; bigint does not cross into the client. */
  balanceLabel: string;
}

export type CategoryOption = CategorySummary;

/** Runs the save; the key stays the same when a lost response is replayed. */
export type SaveTransaction = (
  values: TransactionFormInput,
  submissionKey: string,
) => Promise<Result<TransactionActionSuccess, TransactionActionError>>;

interface UseTransactionFormOptions {
  wallets: readonly WalletOption[];
  categories: readonly CategoryOption[];
  initialValues: TransactionFormInput;
  save: SaveTransaction;
  /** Set when the form records or corrects a refund of one expense. */
  linkedExpense?: LinkedExpenseLimits;
}

/** The exact submission a retry must replay: same key, same values. */
interface PendingSubmission {
  key: string;
  values: TransactionFormInput;
}

export type ServerNotice =
  | { kind: "error"; message: string }
  /** The response was lost; nothing may change until the key is replayed. */
  | { kind: "uncertain" };

export function uncategorizedFor(
  categories: readonly CategoryOption[],
  type: TransactionType,
): string {
  return (
    categories.find((c) => c.kind === type && c.isProtected)?.id ??
    categories.find((c) => c.kind === type)?.id ??
    ""
  );
}

export function useTransactionForm({
  wallets,
  categories,
  initialValues,
  save,
  linkedExpense,
}: Readonly<UseTransactionFormOptions>) {
  const router = useRouter();
  const [notice, setNotice] = useState<ServerNotice | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<TransactionFormField, string>>
  >({});
  const [pending, setPending] = useState<PendingSubmission | null>(null);

  const schema = useMemo(
    () =>
      createTransactionFormSchema({
        walletOpeningDates: Object.fromEntries(
          wallets.map((w) => [w.id, w.openingDate]),
        ),
        linkedExpense,
      }),
    [wallets, linkedExpense],
  );

  const form = useForm({
    defaultValues: initialValues,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: schema,
    },
    onSubmit: async ({ value }) => {
      setNotice(null);
      setFieldErrors({});
      // A retry after a lost response replays the original snapshot and key;
      // a fresh submission mints a new key so intentional repeats are distinct.
      const submission: PendingSubmission = pending ?? {
        key: crypto.randomUUID(),
        values: value,
      };

      let result: Awaited<ReturnType<SaveTransaction>>;
      try {
        result = await save(submission.values, submission.key);
      } catch {
        setPending(submission);
        setNotice({ kind: "uncertain" });
        return;
      }

      if (!result.ok) {
        // The server answered: nothing was committed, so the key is spent
        // and the next submission may carry corrected values.
        setPending(null);
        applyRejection(result.error);
        return;
      }

      setPending(null);
      router.push(`/transactions?saved=${encodeURIComponent(result.value.id)}`);
      router.refresh();
    },
  });

  function applyRejection(error: TransactionActionError) {
    switch (error.code) {
      case "unauthenticated":
        router.push("/sign-in");
        return;
      case "invalid":
        if (error.field) {
          setFieldErrors({ [error.field]: error.message });
        } else {
          setNotice({ kind: "error", message: error.message });
        }
        return;
      case "conflict":
      case "not-found":
        setNotice({ kind: "error", message: error.message });
        return;
    }
  }

  /** Keeps the category inside the tree that matches the chosen type. */
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
      (c) => c.id === form.getFieldValue("categoryId"),
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
    notice,
    fieldErrors,
    clearFieldError,
    changeType,
    /** True while a lost response is waiting to be replayed. */
    awaitingReplay: pending !== null,
  };
}
