"use client";

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

/**
 * The wallet form below 1024px: field cards in the one phone column, and
 * Create wallet fixed to the bottom of the screen. Always a page.
 */
export function WalletFormPhone(props: Readonly<WalletFormProps>) {
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
