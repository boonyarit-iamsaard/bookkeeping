import { Dialog } from "@base-ui/react/dialog";
import { SheetHeader, SheetPortal } from "@/shared/components/ui/sheet";

/** How an entry form hands its outcome to the dialog hosting it. */
export interface EntryDialogHost {
  /** The write succeeded and its reads are refreshed. */
  onSaved: () => void;
  /** Whether the person has changed a field since the form opened. */
  onDirtyChange: (dirty: boolean) => void;
}

interface EntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** A changed form ignores scrim clicks; ✕ and Escape still close it. */
  dirty: boolean;
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
  children,
}: Readonly<EntryDialogProps>) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
      disablePointerDismissal={dirty}
    >
      <SheetPortal>
        <div data-entry-dialog="" className="flex min-h-0 flex-auto flex-col">
          <SheetHeader>{title}</SheetHeader>
          {children}
        </div>
      </SheetPortal>
    </Dialog.Root>
  );
}
