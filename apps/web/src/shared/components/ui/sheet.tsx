"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/helpers/cn";

interface SheetPortalProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * The one panel shape the app uses for a task inside a task: a bottom
 * sheet on phone, a centred content-height dialog from 640px. Wrap it in a
 * Dialog.Root or an AlertDialog.Root, which traps focus, closes on Escape
 * and returns focus to the trigger; the popup caps itself at 85% of the
 * viewport and clips its own scroll area.
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
          {children}
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  );
}

interface SheetHeaderProps {
  children: React.ReactNode;
  /** A caption beneath the title; it becomes the dialog's description. */
  subtitle?: string;
  /** A sheet-specific action before the title, such as a nested-view back. */
  leadingAction?: React.ReactNode;
}

/**
 * A Dialog sheet's title with a 44px ✕ beside it, so dismissal never relies
 * on the scrim or Escape. An alert has no ✕: it is answered, not dismissed.
 */
export function SheetHeader({
  children,
  subtitle,
  leadingAction,
}: Readonly<SheetHeaderProps>) {
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-2 py-2 pr-2 pl-4 sm:pl-6">
      {leadingAction}
      <div className="min-w-0 flex-1">
        <Dialog.Title className="font-semibold text-lg leading-tight">
          {children}
        </Dialog.Title>
        {subtitle && (
          <Dialog.Description className="truncate text-muted-foreground text-sm">
            {subtitle}
          </Dialog.Description>
        )}
      </div>
      <Dialog.Close
        aria-label="Close"
        render={<Button type="button" variant="ghost" size="icon-touch" />}
      >
        <X strokeWidth={1.75} className="size-5" />
      </Dialog.Close>
    </header>
  );
}
