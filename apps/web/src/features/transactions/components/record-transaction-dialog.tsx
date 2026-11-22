import { useRouter } from "@tanstack/react-router";
import { createContext, useContext } from "react";
import { isSignedInPathname } from "@/core/router/router";
import type { CaptureLinkSearch } from "@/core/shell/capture-link-search";
import { parseCaptureOrigin } from "@/features/transactions/capture-origin";
import { RecordTransaction } from "@/features/transactions/components/record-transaction";
import {
  EntryDialog,
  EntrySavedNotice,
  useEntryDialog,
} from "@/shared/components/form/entry-dialog";

const OpenRecordDialog = createContext<(() => void) | null>(null);

/**
 * Opens New transaction over the current screen, or null where there is no
 * dialog (below 1024px), so the caller navigates to the page instead.
 */
export function useOpenRecordDialog(): (() => void) | null {
  return useContext(OpenRecordDialog);
}

interface RecordTransactionDialogProps {
  captureSearch: CaptureLinkSearch;
  children: (openRecord: () => void) => React.ReactNode;
}

/**
 * New transaction as a dialog over the screen it was opened from, for the
 * desktop shell. Save closes it, leaves the refreshed screen in place and
 * confirms with a Saved notice.
 */
export function RecordTransactionDialog({
  captureSearch,
  children,
}: Readonly<RecordTransactionDialogProps>) {
  const router = useRouter();
  const record = useEntryDialog();
  const openRecord = () => record.open();

  return (
    <OpenRecordDialog.Provider value={openRecord}>
      {children(openRecord)}
      {record.saved && (
        <EntrySavedNotice>
          <span className="font-semibold">Transaction saved.</span> Balances and
          lists on this screen include it.
        </EntrySavedNotice>
      )}
      <EntryDialog
        {...record.dialog}
        title="New transaction"
        loadError="Your wallets could not load. Try again; nothing has been recorded."
      >
        <RecordTransaction
          captureOrigin={parseCaptureOrigin(captureSearch.origin, (pathname) =>
            isSignedInPathname(router, pathname),
          )}
          requestedWalletId={captureSearch.wallet}
          host={record.host}
        />
      </EntryDialog>
    </OpenRecordDialog.Provider>
  );
}
