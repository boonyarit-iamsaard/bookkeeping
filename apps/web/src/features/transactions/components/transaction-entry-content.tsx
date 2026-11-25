import type { components } from "@/core/api/openapi.gen";
import type { CaptureOrigin } from "@/features/transactions/capture-origin";
import {
  EditTransaction,
  editTransactionTitle,
} from "@/features/transactions/components/edit-transaction";
import { RecordRefund } from "@/features/transactions/components/record-refund";
import { RecordTransaction } from "@/features/transactions/components/record-transaction";
import type { TransactionFormProps } from "@/features/transactions/hooks/use-transaction-entry-form";

interface NewEntry {
  kind: "record";
  captureOrigin: CaptureOrigin;
  requestedWalletId?: string;
}

interface CorrectionEntry {
  kind: "correct";
  transactionId: string;
  transactionType: components["schemas"]["Transaction"]["type"];
}

interface RefundEntry {
  kind: "refund";
  transactionId: string;
}

export type TransactionEntry = NewEntry | CorrectionEntry | RefundEntry;

export function transactionEntryTitle(entry: Readonly<TransactionEntry>) {
  switch (entry.kind) {
    case "record":
      return "New transaction";
    case "correct":
      return editTransactionTitle(entry.transactionType);
    case "refund":
      return "Record refund";
  }
}

interface TransactionEntryContentProps {
  entry: TransactionEntry;
  formComponent: React.ComponentType<TransactionFormProps>;
}

export function TransactionEntryContent({
  entry,
  formComponent,
}: Readonly<TransactionEntryContentProps>) {
  switch (entry.kind) {
    case "record":
      return (
        <RecordTransaction
          captureOrigin={entry.captureOrigin}
          requestedWalletId={entry.requestedWalletId}
          formComponent={formComponent}
        />
      );
    case "correct":
      return (
        <EditTransaction
          transactionId={entry.transactionId}
          formComponent={formComponent}
        />
      );
    case "refund":
      return (
        <RecordRefund
          expenseId={entry.transactionId}
          formComponent={formComponent}
        />
      );
  }
}
