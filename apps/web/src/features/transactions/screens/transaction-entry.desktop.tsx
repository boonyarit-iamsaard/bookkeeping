import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import type { TransactionEntry } from "@/features/transactions/components/transaction-entry-content";
import {
  TransactionEntryContent,
  transactionEntryTitle,
} from "@/features/transactions/components/transaction-entry-content";
import { Skeleton } from "@/shared/components/skeleton";
import { TransactionFormDesktop } from "./transaction-form.desktop";

interface TransactionEntryDesktopProps {
  entry: TransactionEntry;
}

export function TransactionEntryDesktop({
  entry,
}: Readonly<TransactionEntryDesktopProps>) {
  return (
    <Page layout="column">
      <TitleBar
        title={transactionEntryTitle(entry)}
        back={
          entry.kind !== "record" && (
            <BackLink
              to="/transactions/$transactionId"
              params={{ transactionId: entry.transactionId }}
              aria-label="Back to transaction"
            />
          )
        }
      />
      <TransactionEntryContent
        entry={entry}
        formComponent={TransactionFormDesktop}
      />
    </Page>
  );
}

interface TransactionEntryDesktopLoadingProps {
  title: string;
  fixedType?: boolean;
}

export function TransactionEntryDesktopLoading({
  title,
  fixedType,
}: Readonly<TransactionEntryDesktopLoadingProps>) {
  return (
    <Page layout="column" loading>
      <TitleBar title={title} />
      <output className="sr-only">Loading entry form…</output>
      <div
        aria-hidden="true"
        className="bg-card shadow-card overflow-hidden rounded-2xl"
      >
        <div className="grid grid-cols-2 items-start gap-6 p-6">
          <Skeleton className="h-16" />
          <Skeleton className={fixedType ? "col-span-2 h-11" : "h-16"} />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="col-span-2 h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-24" />
        </div>
        <div className="flex justify-end gap-3 border-t px-6 pt-4 pb-6">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </Page>
  );
}
