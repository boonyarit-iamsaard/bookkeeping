"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useNavigate } from "@tanstack/react-router";
import {
  TransactionEditFooter,
  TransactionSaveButton,
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
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { cn } from "@/shared/helpers/cn";
import { isPlainClick } from "@/shared/helpers/plain-click";

interface CancelProps {
  hosted: boolean;
  href: string;
}

/** Closes the dialog, or on a page leads back to where the entry opened. */
function Cancel({ hosted, href }: Readonly<CancelProps>) {
  const navigate = useNavigate();
  if (hosted) {
    return (
      <Dialog.Close render={<Button type="button" variant="ghost" size="lg" />}>
        Cancel
      </Dialog.Close>
    );
  }
  return (
    <a
      href={href}
      onClick={(event) => {
        if (isPlainClick(event)) {
          event.preventDefault();
          void navigate({ href });
        }
      }}
      className={buttonVariants({ variant: "ghost", size: "lg" })}
    >
      Cancel
    </a>
  );
}

/**
 * The entry form from 1024px: related fields in two columns, and Save and
 * Cancel pinned to the foot while only the fields scroll. In the entry dialog
 * the dialog is its surface; on a direct URL it is its own card.
 */
export function TransactionFormDesktop(props: Readonly<TransactionFormProps>) {
  const entryForm = useTransactionEntryForm(props);
  const { form, formRef, wallets, editing, entry, pending, submit } = entryForm;
  const hosted = Boolean(props.host);

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
        <ServerErrorNotice entryForm={entryForm} />

        <TransactionFieldset entryForm={entryForm}>
          {(busy) => (
            <div className="grid grid-cols-2 items-start gap-x-6 gap-y-6 *:min-w-0">
              <AmountSection entryForm={entryForm} />
              {/* A fixed type brings the linked expense and a long note: full width. */}
              <div className={cn(entry.fixedType && "col-span-2")}>
                <TypeSection entryForm={entryForm} />
              </div>
              <SourceWalletSection entryForm={entryForm} />
              <CategorySection entryForm={entryForm} busy={busy} />
              <div className="col-span-2 empty:hidden">
                <TagsSection entryForm={entryForm} busy={busy} />
              </div>
              <DateSection entryForm={entryForm} busy={busy} />
              <NoteSection entryForm={entryForm} />
            </div>
          )}
        </TransactionFieldset>

        {editing && (
          <TransactionEditFooter
            transaction={editing}
            wallets={wallets}
            pending={pending}
          />
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-3 border-t px-6 pt-4 pb-6">
        <Cancel hosted={hosted} href={entry.cancelHref} />
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
            <TransactionSaveButton
              wallets={wallets}
              pending={pending}
              {...state}
            />
          )}
        </form.Subscribe>
      </footer>
    </form>
  );
}
