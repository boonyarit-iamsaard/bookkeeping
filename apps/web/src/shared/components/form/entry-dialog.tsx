import { Dialog } from "@base-ui/react/dialog";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { CatchBoundary, useLocation } from "@tanstack/react-router";
import { Suspense, useCallback, useRef, useState } from "react";
import { ErrorNotice } from "@/shared/components/error-notice";
import { SavedNotice } from "@/shared/components/saved-notice";
import { Skeleton } from "@/shared/components/skeleton";
import { Button } from "@/shared/components/ui/button";
import { SheetHeader, SheetPortal } from "@/shared/components/ui/sheet";

/** How an entry form hands its outcome to the dialog hosting it. */
export interface EntryDialogHost {
  /** The write succeeded and its reads are refreshed. */
  onSaved: () => void;
  /** Whether the person has changed a field since the form opened. */
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * The state of one screen's entry dialog. `entry` is what was opened last; it
 * stays set while the dialog closes, so its content holds through the exit.
 * The dialog and its Saved notice each belong to the address they opened on,
 * so leaving the screen closes the one and retires the other.
 */
export function useEntryDialog<T = void>() {
  const { href } = useLocation();
  const [entry, setEntry] = useState<T | null>(null);
  const [openOn, setOpenOn] = useState<string | null>(null);
  const [savedOn, setSavedOn] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // A save still pending when its dialog closed must not close a later opening.
  const [opening, setOpening] = useState(0);
  const latestOpening = useRef(0);
  if (openOn !== null && openOn !== href) {
    setOpenOn(null);
  }
  if (savedOn !== null && savedOn !== href) {
    setSavedOn(null);
  }
  // Changes only when an entry opens or the address changes, so a context
  // value built from it does not churn on every render.
  const open = useCallback(
    (next: T) => {
      setEntry(next);
      setDirty(false);
      setSavedOn(null);
      setOpenOn(href);
      latestOpening.current = opening + 1;
      setOpening(opening + 1);
    },
    [href, opening],
  );

  return {
    entry,
    saved: savedOn !== null,
    open,
    dialog: {
      open: openOn !== null,
      onOpenChange: (open: boolean) => {
        if (!open) {
          setOpenOn(null);
        }
      },
      dirty,
    },
    host: {
      onSaved: () => {
        if (latestOpening.current !== opening) {
          return;
        }
        setOpenOn(null);
        setSavedOn(href);
      },
      onDirtyChange: setDirty,
    } satisfies EntryDialogHost,
  };
}

/** The dialog body while its reads load: busy, and without sample money. */
function EntryLoading() {
  return (
    <output
      aria-busy="true"
      aria-label="Loading"
      className="flex flex-col gap-6 border-t px-6 py-6"
    >
      <Skeleton className="h-16 rounded-lg" />
      <Skeleton className="h-10 rounded-lg" />
      <Skeleton className="h-10 rounded-lg" />
    </output>
  );
}

interface EntryLoadErrorProps extends ErrorComponentProps {
  message: React.ReactNode;
}

/** A failed load stays inside the dialog, so the screen behind keeps its place. */
function EntryLoadError({ reset, message }: Readonly<EntryLoadErrorProps>) {
  const { reset: resetQueries } = useQueryErrorResetBoundary();
  return (
    <div className="flex flex-col items-start gap-4 border-t px-6 py-6">
      <ErrorNotice>{message}</ErrorNotice>
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

interface EntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** A changed form ignores scrim clicks; ✕ and Escape still close it. */
  dirty: boolean;
  /** What a failed load says, with nothing saved yet. */
  loadError: React.ReactNode;
  /** Widens or narrows the dialog; the default fits one column of fields. */
  className?: string;
  children: React.ReactNode;
}

/**
 * An entry form (record, edit or refund a transaction, create a wallet) over
 * the screen it was opened from, used from 1024px. The house dialog: the
 * title and ✕ stay put above, Save stays put below, and the `entry-form`
 * parts inside switch from page cards to hairline-divided sections.
 */
export function EntryDialog({
  open,
  onOpenChange,
  title,
  dirty,
  loadError,
  className,
  children,
}: Readonly<EntryDialogProps>) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
      disablePointerDismissal={dirty}
    >
      <SheetPortal className={className}>
        <div className="flex min-h-0 flex-auto flex-col">
          <SheetHeader>{title}</SheetHeader>
          <CatchBoundary
            getResetKey={() => String(open)}
            errorComponent={(props) => (
              <EntryLoadError {...props} message={loadError} />
            )}
          >
            <Suspense fallback={<EntryLoading />}>{children}</Suspense>
          </CatchBoundary>
        </div>
      </SheetPortal>
    </Dialog.Root>
  );
}

interface EntrySavedNoticeProps {
  children: React.ReactNode;
}

/** The Saved notice an entry dialog leaves on the screen it closed onto. */
export function EntrySavedNotice({
  children,
}: Readonly<EntrySavedNoticeProps>) {
  return (
    <SavedNotice className="shadow-float fixed bottom-6 left-1/2 z-40 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2">
      {children}
    </SavedNotice>
  );
}
