"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CategorySummary } from "@/features/categories/server/operations";
import type {
  CreateTransactionActionError,
  TransactionFormField,
} from "@/features/transactions/server/actions";
import { createTransactionAction } from "@/features/transactions/server/actions";
import type { TransactionFormInput } from "@/features/transactions/transaction-form-schema";
import { createTransactionFormSchema } from "@/features/transactions/transaction-form-schema";
import type { TransactionType } from "@/features/transactions/transaction-types";
import type { WalletType } from "@/features/wallets/wallet-types";
import type { CalendarDate } from "@/shared/helpers/dates";

export interface WalletOption {
  id: string;
  name: string;
  type: WalletType;
  openingDate: CalendarDate;
  /** Pre-formatted on the server; bigint does not cross into the client. */
  balanceLabel: string;
}

export type CategoryOption = CategorySummary;

interface UseTransactionFormOptions {
  wallets: readonly WalletOption[];
  categories: readonly CategoryOption[];
  /** Today in Asia/Bangkok, computed on the server. */
  today: CalendarDate;
  defaultWalletId: string;
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

function uncategorizedFor(
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
  today,
  defaultWalletId,
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
      }),
    [wallets],
  );

  const defaultValues: TransactionFormInput = {
    type: "expense",
    walletId: defaultWalletId,
    categoryId: uncategorizedFor(categories, "expense"),
    amount: "",
    transactionDate: today,
    note: "",
  };

  const form = useForm({
    defaultValues,
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
      const payload = { ...submission.values, submissionKey: submission.key };

      let result: Awaited<ReturnType<typeof createTransactionAction>>;
      try {
        result = await createTransactionAction(payload);
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

  function applyRejection(error: CreateTransactionActionError) {
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
        setNotice({ kind: "error", message: error.message });
        return;
    }
  }

  /** Keeps the category inside the tree that matches the chosen type. */
  function changeType(type: TransactionType) {
    form.setFieldValue("type", type);
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
