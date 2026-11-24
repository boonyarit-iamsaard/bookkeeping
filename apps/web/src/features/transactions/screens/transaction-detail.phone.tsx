import type { components } from "@/core/api/openapi.gen";
import { Page } from "@/core/shell/page";
import { TransactionDetailBody } from "@/features/transactions/components/transaction-detail-body";

interface TransactionDetailPhoneProps {
  transaction: components["schemas"]["Transaction"];
}

/** Edit and Record refund navigate to their own pages. */
export function TransactionDetailPhone({
  transaction,
}: Readonly<TransactionDetailPhoneProps>) {
  return (
    <Page layout="column">
      <TransactionDetailBody
        transaction={transaction}
        onEdit={null}
        onRecordRefund={null}
      />
    </Page>
  );
}
