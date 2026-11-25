"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Link } from "@tanstack/react-router";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import {
  CreateWalletButton,
  OpeningAmountField,
  OpeningDateField,
  WalletNameField,
  WalletSavingsField,
  WalletTypeField,
} from "@/features/wallets/components/wallet-form-sections";
import type { WalletFormProps } from "@/features/wallets/hooks/use-wallet-entry-form";
import { useWalletEntryForm } from "@/features/wallets/hooks/use-wallet-entry-form";
import { ErrorNotice } from "@/shared/components/error-notice";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { cn } from "@/shared/helpers/cn";

/**
 * The wallet form from 1024px: the opening balance beside its date, and
 * Cancel and Create wallet pinned to the foot while only the fields scroll.
 * In the entry dialog the dialog is its surface; on a direct URL it is its
 * own card.
 */
export function WalletFormDesktop(props: Readonly<WalletFormProps>) {
  const entryForm = useWalletEntryForm(props);
  const { formRef, hosted, serverError, submit } = entryForm;

  return (
    <form
      ref={formRef}
      noValidate
      className={cn(
        "flex min-h-0 flex-auto flex-col",
        !hosted && "bg-card shadow-card overflow-hidden rounded-2xl",
      )}
      onSubmit={submit}
    >
      <div
        className={cn(
          "flex min-h-0 flex-auto [scrollbar-width:thin] flex-col gap-6 overflow-y-auto px-6 py-6 *:shrink-0",
          hosted && "border-t",
        )}
      >
        {serverError && <ErrorNotice>{serverError}</ErrorNotice>}
        <WalletNameField entryForm={entryForm} />
        <WalletTypeField entryForm={entryForm} />
        <WalletSavingsField entryForm={entryForm} />
        <div className="grid grid-cols-2 items-start gap-x-6 gap-y-6 border-t pt-6 *:min-w-0">
          <OpeningAmountField entryForm={entryForm} />
          <OpeningDateField entryForm={entryForm} />
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-3 border-t px-6 pt-4 pb-6">
        {hosted ? (
          <Dialog.Close
            render={<Button type="button" variant="ghost" size="lg" />}
          >
            Cancel
          </Dialog.Close>
        ) : (
          <Link
            to="/wallets"
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            Cancel
          </Link>
        )}
        <CreateWalletButton entryForm={entryForm} />
      </footer>
    </form>
  );
}

export function NewWalletDesktop() {
  return (
    <Page layout="column">
      <TitleBar title="New wallet" />
      <WalletFormDesktop />
    </Page>
  );
}
