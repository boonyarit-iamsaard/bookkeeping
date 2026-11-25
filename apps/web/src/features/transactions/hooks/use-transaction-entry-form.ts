import { addDays } from "@bookkeeping/domain/dates";
import { useStore } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCategoryCatalog } from "@/features/categories/hooks/use-category-catalog";
import { useTransactionForm } from "@/features/transactions/hooks/use-transaction-form";
import type { WalletOption } from "@/features/transactions/transaction.types";
import type { EntryMode } from "@/features/transactions/transaction-entry";
import { openEntry } from "@/features/transactions/transaction-entry";
import type { EntryDialogHost } from "@/shared/components/form/entry-dialog";
import { useToday } from "@/shared/hooks/use-today";

/** What both compositions of the entry form are given. */
export interface TransactionFormProps {
  wallets: readonly WalletOption[];
  mode: EntryMode;
  /** Set inside an entry dialog, which owns closing and the outcome of a save. */
  host?: EntryDialogHost;
}

/**
 * Everything the phone and desktop compositions of the entry form share:
 * the opened entry, the form state and its writes, Escape on a page, and the
 * dirty flag a dialog reads. They share no layout.
 */
export function useTransactionEntryForm({
  wallets,
  mode,
  host,
}: Readonly<TransactionFormProps>) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const { categories } = useCategoryCatalog();
  const today = useToday();
  const [openedOn] = useState(today);
  const entry = useMemo(
    () => openEntry({ mode, categories, today: openedOn }),
    [mode, categories, openedOn],
  );
  const { correcting: editing, linkedExpense: linked, cancelHref } = entry;
  const archivedWallet =
    mode.kind === "refund" && mode.expense.wallet.archived
      ? mode.expense.wallet
      : undefined;

  useEffect(() => {
    const element = formRef.current;
    // A dialog closes on Escape itself and has no page to cancel to.
    if (!element || host) {
      return;
    }
    const formElement = element;
    function cancelOnEscape(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        event.target instanceof Node &&
        formElement.contains(event.target)
      ) {
        event.preventDefault();
        void navigate({ href: cancelHref });
      }
    }
    document.addEventListener("keydown", cancelOnEscape);
    return () => document.removeEventListener("keydown", cancelOnEscape);
  }, [navigate, cancelHref, host]);

  const state = useTransactionForm({
    entry,
    wallets,
    categories,
    today,
    onSaved: host?.onSaved,
  });
  const { form, clearFieldError } = state;
  const dirty = useStore(form.store, (current) => current.isDirty);
  const onDirtyChange = host?.onDirtyChange;
  useEffect(() => onDirtyChange?.(dirty), [onDirtyChange, dirty]);

  function swapWallets() {
    const from = form.getFieldValue("walletId");
    const to = form.getFieldValue("destinationWalletId");
    if (!from || !to) {
      return;
    }
    form.setFieldValue("walletId", to);
    form.setFieldValue("destinationWalletId", from);
    clearFieldError("walletId");
    clearFieldError("destinationWalletId");
    clearFieldError("transactionDate");
  }

  return {
    ...state,
    formRef,
    wallets,
    mode,
    entry,
    editing,
    linked,
    archivedWallet,
    today,
    yesterday: addDays(today, -1),
    swapWallets,
    submit: (event: React.SyntheticEvent) => {
      event.preventDefault();
      event.stopPropagation();
      void form.handleSubmit();
    },
  };
}

export type TransactionEntryForm = ReturnType<typeof useTransactionEntryForm>;
