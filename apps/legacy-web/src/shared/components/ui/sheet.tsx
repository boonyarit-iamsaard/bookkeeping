"use client";

import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/shared/helpers/cn";

interface SheetPortalProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * The one panel shape the app uses for a task inside a task: a bottom
 * sheet on phone, a centred dialog from 640px. Wrap it in a Dialog.Root;
 * the popup sizes itself to the viewport and clips its own scroll area.
 */
export function SheetPortal({
  children,
  className,
}: Readonly<SheetPortalProps>) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
      <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
        <Dialog.Popup
          className={cn(
            "flex max-h-[min(100%,calc(100dvh-3rem))] w-full flex-col overflow-hidden bg-background text-foreground outline-none",
            "rounded-t-xl transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] data-ending-style:translate-y-full data-starting-style:translate-y-full motion-reduce:transition-none",
            "sm:h-[36rem] sm:max-w-md sm:rounded-xl sm:border sm:duration-200 sm:data-ending-style:translate-y-2 sm:data-starting-style:translate-y-2 sm:data-ending-style:scale-[0.98] sm:data-starting-style:scale-[0.98] sm:data-ending-style:opacity-0 sm:data-starting-style:opacity-0",
            className,
          )}
        >
          {children}
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  );
}
