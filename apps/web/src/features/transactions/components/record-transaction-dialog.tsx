import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { CatchBoundary, useLocation, useRouter } from "@tanstack/react-router";
import { createContext, Suspense, useContext, useState } from "react";
import { isSignedInPathname } from "@/core/router/router";
import type { CaptureLinkSearch } from "@/core/shell/capture-link-search";
import { parseCaptureOrigin } from "@/features/transactions/capture-origin";
import { RecordTransaction } from "@/features/transactions/components/record-transaction";
import { ErrorNotice } from "@/shared/components/error-notice";
import { EntryDialog } from "@/shared/components/form/entry-dialog";
import { SavedNotice } from "@/shared/components/saved-notice";
import { Skeleton } from "@/shared/components/skeleton";
import { Button } from "@/shared/components/ui/button";

const OpenRecordDialog = createContext<(() => void) | null>(null);

/**
 * Opens New transaction over the current screen, or null where there is no
 * dialog (below 1024px), so the caller navigates to the page instead.
 */
export function useOpenRecordDialog(): (() => void) | null {
  return useContext(OpenRecordDialog);
}

/** The dialog body while its wallets load: busy, and without sample money. */
function RecordLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className="flex flex-col gap-6 border-t px-6 py-6"
    >
      <Skeleton className="h-16 rounded-lg" />
      <Skeleton className="h-10 rounded-lg" />
      <Skeleton className="h-10 rounded-lg" />
    </div>
  );
}

/** A failed load stays inside the dialog, so the screen behind keeps its place. */
function RecordLoadError({ reset }: Readonly<ErrorComponentProps>) {
  const { reset: resetQueries } = useQueryErrorResetBoundary();
  return (
    <div className="flex flex-col items-start gap-4 border-t px-6 py-6">
      <ErrorNotice>
        Your wallets could not load. Try again; nothing has been recorded.
      </ErrorNotice>
      <Button
        size="lg"
        onClick={() => {
          resetQueries();
          reset();
        }}
      >
        Try again
      </Button>
    </div>
  );
}

interface RecordTransactionDialogProps {
  captureSearch: CaptureLinkSearch;
  children: (openRecord: () => void) => React.ReactNode;
}

/**
 * New transaction as a dialog over the screen it was opened from, for the
 * desktop shell. Save closes it, leaves the refreshed screen in place and
 * confirms with a Saved notice; leaving the screen closes the dialog and
 * retires the notice.
 */
export function RecordTransactionDialog({
  captureSearch,
  children,
}: Readonly<RecordTransactionDialogProps>) {
  const router = useRouter();
  const { href } = useLocation();
  // Each holds the address it belongs to, so it lapses once that changes.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const [savedOn, setSavedOn] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  if (openOn !== null && openOn !== href) {
    setOpenOn(null);
  }
  if (savedOn !== null && savedOn !== href) {
    setSavedOn(null);
  }

  function openRecord() {
    setDirty(false);
    setSavedOn(null);
    setOpenOn(href);
  }

  return (
    <OpenRecordDialog.Provider value={openRecord}>
      {children(openRecord)}
      {savedOn !== null && (
        <SavedNotice className="shadow-float fixed bottom-6 left-1/2 z-40 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2">
          <span className="font-semibold">Transaction saved.</span> Balances and
          lists on this screen include it.
        </SavedNotice>
      )}
      <EntryDialog
        open={openOn !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOpenOn(null);
          }
        }}
        title="New transaction"
        dirty={dirty}
      >
        <CatchBoundary
          getResetKey={() => openOn ?? ""}
          errorComponent={RecordLoadError}
        >
          <Suspense fallback={<RecordLoading />}>
            <RecordTransaction
              captureOrigin={parseCaptureOrigin(
                captureSearch.origin,
                (pathname) => isSignedInPathname(router, pathname),
              )}
              requestedWalletId={captureSearch.wallet}
              host={{
                onSaved: () => {
                  setOpenOn(null);
                  setSavedOn(href);
                },
                onDirtyChange: setDirty,
              }}
            />
          </Suspense>
        </CatchBoundary>
      </EntryDialog>
    </OpenRecordDialog.Provider>
  );
}
