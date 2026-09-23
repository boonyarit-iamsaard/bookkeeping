"use client";

import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/shared/helpers/cn";

interface SheetPortalProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * The one panel shape the app uses for a task inside a task: a bottom
 * sheet on phone, a centred content-height dialog from 640px. Wrap it in a
 * Dialog.Root, which traps focus, closes on Escape and returns focus to the
 * trigger; the popup caps itself at 85% of the viewport and clips its own
 * scroll area.
 */
export function SheetPortal({
  children,
  className,
}: Readonly<SheetPortalProps>) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
      <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
        <Dialog.Popup
          className={cn(
            "flex max-h-[85dvh] w-full flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)] text-foreground outline-none",
            "rounded-t-[14px] transition-transform duration-200 ease-out data-ending-style:translate-y-full data-starting-style:translate-y-full motion-reduce:transition-none",
            "sm:max-w-md sm:rounded-[14px] sm:pb-0 sm:transition-opacity sm:data-ending-style:translate-y-0 sm:data-starting-style:translate-y-0 sm:data-ending-style:opacity-0 sm:data-starting-style:opacity-0",
            className,
          )}
        >
          <div
            aria-hidden="true"
            className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border sm:hidden"
          />
          {children}
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  );
}
