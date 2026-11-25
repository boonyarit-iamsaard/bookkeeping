import { useStore } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useCreateWalletForm } from "@/features/wallets/hooks/use-create-wallet-form";
import type { EntryDialogHost } from "@/shared/components/form/entry-dialog";

/** What both compositions of the wallet form are given. */
export interface WalletFormProps {
  /** Set inside an entry dialog, which owns closing and the outcome of a save. */
  host?: EntryDialogHost;
}

/**
 * Everything the phone and desktop compositions of the wallet form share:
 * the form state and its write, Escape on a page, and the dirty flag a
 * dialog reads. They share no layout.
 */
export function useWalletEntryForm({ host }: Readonly<WalletFormProps>) {
  const navigate = useNavigate();
  const state = useCreateWalletForm({ onSaved: host?.onSaved });
  const { form } = state;
  const formRef = useRef<HTMLFormElement>(null);
  const hosted = Boolean(host);
  const dirty = useStore(form.store, (current) => current.isDirty);
  const onDirtyChange = host?.onDirtyChange;
  useEffect(() => onDirtyChange?.(dirty), [onDirtyChange, dirty]);

  useEffect(() => {
    const element = formRef.current;
    if (!element) {
      return;
    }
    const formElement = element;
    formElement.dataset.ready = "true";
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && event.target instanceof Node) {
        // A dialog closes on Escape itself and has no page to cancel to.
        if (hosted || !formElement.contains(event.target)) {
          return;
        }
        event.preventDefault();
        void navigate({ to: "/wallets" });
      }
    }
    formElement.addEventListener("keydown", handleEscape);
    return () => formElement.removeEventListener("keydown", handleEscape);
  }, [navigate, hosted]);

  return {
    ...state,
    formRef,
    hosted,
    submit: (event: React.SyntheticEvent) => {
      event.preventDefault();
      event.stopPropagation();
      void form.handleSubmit();
    },
  };
}

export type WalletEntryForm = ReturnType<typeof useWalletEntryForm>;
