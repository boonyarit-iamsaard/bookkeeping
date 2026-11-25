"use client";

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
import { EntrySaveBar, FormCard } from "@/shared/components/form/entry-form";
import { buttonVariants } from "@/shared/components/ui/button";

/**
 * The wallet form below 1024px: field cards in the one phone column, and
 * Create wallet fixed to the bottom of the screen. Always a page.
 */
function WalletFormPhone(props: Readonly<WalletFormProps>) {
  const entryForm = useWalletEntryForm(props);
  const { formRef, serverError, submit } = entryForm;

  return (
    <form
      ref={formRef}
      noValidate
      className="flex flex-col gap-6 sm:gap-8"
      onSubmit={submit}
    >
      {serverError && <ErrorNotice>{serverError}</ErrorNotice>}

      <FormCard>
        <WalletNameField entryForm={entryForm} />
        <WalletTypeField entryForm={entryForm} />
        <WalletSavingsField entryForm={entryForm} />
      </FormCard>

      <FormCard>
        <OpeningAmountField entryForm={entryForm} />
        <OpeningDateField entryForm={entryForm} />
      </FormCard>

      <EntrySaveBar>
        <CreateWalletButton
          entryForm={entryForm}
          className="h-12 w-full text-base"
        />
      </EntrySaveBar>
    </form>
  );
}

export function NewWalletPhone() {
  return (
    <Page layout="entry">
      <TitleBar
        title="New wallet"
        actions={
          <Link
            to="/wallets"
            className={buttonVariants({
              variant: "ghost",
              size: "lg",
              className: "-mr-3",
            })}
          >
            Cancel
          </Link>
        }
      />
      <WalletFormPhone />
    </Page>
  );
}
