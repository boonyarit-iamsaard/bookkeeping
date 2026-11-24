import { SavedNotice } from "@/shared/components/saved-notice";

/** Confirms a delete on the history the delete returned to. */
export function TransactionDeletedNotice() {
  return (
    <SavedNotice>
      <span className="font-semibold">Transaction deleted.</span> It no longer
      counts toward any wallet balance.
    </SavedNotice>
  );
}
