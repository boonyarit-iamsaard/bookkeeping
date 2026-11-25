"use client";

import {
  TransactionEditFooter,
  TransactionSaveBar,
} from "@/features/transactions/components/transaction-form-actions";
import {
  AmountSection,
  CategorySection,
  DateSection,
  NoteSection,
  ServerErrorNotice,
  SourceWalletSection,
  TagsSection,
  TransactionFieldset,
  TypeSection,
} from "@/features/transactions/components/transaction-form-sections";
import type { TransactionFormProps } from "@/features/transactions/hooks/use-transaction-entry-form";
import { useTransactionEntryForm } from "@/features/transactions/hooks/use-transaction-entry-form";
import { FormCard } from "@/shared/components/form/entry-form";

/**
 * The entry form below 1024px: field cards in the one phone column, and Save
 * fixed to the bottom of the screen. Always a page, never in a dialog.
 */
export function TransactionFormPhone(props: Readonly<TransactionFormProps>) {
  const entryForm = useTransactionEntryForm(props);
  const { form, formRef, wallets, editing, pending, submit } = entryForm;

  return (
    <form
      ref={formRef}
      noValidate
      className="flex flex-col gap-6 sm:gap-8"
      onSubmit={submit}
    >
      <ServerErrorNotice entryForm={entryForm} />

      <TransactionFieldset entryForm={entryForm}>
        {(busy) => (
          <>
            <FormCard>
              <AmountSection entryForm={entryForm} />
              <TypeSection entryForm={entryForm} />
            </FormCard>

            <FormCard>
              <SourceWalletSection entryForm={entryForm} />
              <CategorySection entryForm={entryForm} busy={busy} />
              <TagsSection entryForm={entryForm} busy={busy} />
              <DateSection entryForm={entryForm} busy={busy} />
              <NoteSection entryForm={entryForm} />
            </FormCard>
          </>
        )}
      </TransactionFieldset>

      {editing && (
        <TransactionEditFooter
          transaction={editing}
          wallets={wallets}
          pending={pending}
        />
      )}

      <form.Subscribe
        selector={(state) => ({
          isSubmitting: state.isSubmitting,
          type: state.values.type,
          amount: state.values.amount,
          walletId: state.values.walletId,
          destinationWalletId: state.values.destinationWalletId,
        })}
      >
        {(state) => (
          <TransactionSaveBar wallets={wallets} pending={pending} {...state} />
        )}
      </form.Subscribe>
    </form>
  );
}
