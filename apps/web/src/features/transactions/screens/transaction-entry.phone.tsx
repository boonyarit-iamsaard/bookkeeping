import { Link, useRouter } from "@tanstack/react-router";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import { captureOriginHref } from "@/features/transactions/capture-origin";
import type { TransactionEntry } from "@/features/transactions/components/transaction-entry-content";
import {
  TransactionEntryContent,
  transactionEntryTitle,
} from "@/features/transactions/components/transaction-entry-content";
import { EntrySaveBar, FormCard } from "@/shared/components/form/entry-form";
import { Skeleton } from "@/shared/components/skeleton";
import { buttonVariants } from "@/shared/components/ui/button";
import { isPlainClick } from "@/shared/helpers/plain-click";
import { TransactionFormPhone } from "./transaction-form.phone";

interface TransactionEntryPhoneProps {
  entry: TransactionEntry;
}

function CancelEntry({ entry }: Readonly<TransactionEntryPhoneProps>) {
  const router = useRouter();
  const className = buttonVariants({
    variant: "ghost",
    size: "lg",
    className: "-mr-3",
  });

  if (entry.kind !== "record") {
    return (
      <Link
        to="/transactions/$transactionId"
        params={{ transactionId: entry.transactionId }}
        className={className}
      >
        Cancel
      </Link>
    );
  }
  const href = captureOriginHref(entry.captureOrigin);
  return (
    <a
      href={href}
      onClick={(event) => {
        if (isPlainClick(event)) {
          event.preventDefault();
          void router.navigate({ href });
        }
      }}
      className={className}
    >
      Cancel
    </a>
  );
}

export function TransactionEntryPhone({
  entry,
}: Readonly<TransactionEntryPhoneProps>) {
  return (
    <Page layout="entry">
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
        actions={<CancelEntry entry={entry} />}
      />
      <TransactionEntryContent
        entry={entry}
        formComponent={TransactionFormPhone}
      />
    </Page>
  );
}

interface TransactionEntryPhoneLoadingProps {
  title: string;
}

export function TransactionEntryPhoneLoading({
  title,
}: Readonly<TransactionEntryPhoneLoadingProps>) {
  return (
    <Page layout="entry" loading>
      <TitleBar title={title} />
      <output className="sr-only">Loading entry form…</output>
      <div aria-hidden="true" className="contents">
        <FormCard>
          <Skeleton className="h-16" />
          <Skeleton className="h-11" />
        </FormCard>
        <FormCard>
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-24" />
        </FormCard>
        <EntrySaveBar>
          <Skeleton className="h-12" />
        </EntrySaveBar>
      </div>
    </Page>
  );
}
