"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Link } from "@tanstack/react-router";
import { LogOut, Tags } from "lucide-react";
import { useState } from "react";
import {
  AccountDisc,
  accountLabel,
} from "@/features/auth/components/account-disc";
import { useSignOut } from "@/features/auth/hooks/use-sign-out";
import { SheetPortal } from "@/shared/components/ui/sheet";

interface AccountSheetProps {
  email: string;
}

const ROW_CLASS =
  "flex min-h-12 w-full items-center gap-3 px-4 text-left outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset disabled:opacity-50";

/**
 * The phone account control in Home's title bar: the initial disc opens a
 * sheet naming the signed-in email, then Categories and Sign out. From 640px
 * the header's account menu does this job instead.
 */
export function AccountSheet({ email }: Readonly<AccountSheetProps>) {
  const [open, setOpen] = useState(false);
  const { signOut, isPending } = useSignOut();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label={accountLabel(email)}
        className="-mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <AccountDisc email={email} className="size-8" />
      </Dialog.Trigger>
      <SheetPortal>
        <Dialog.Title className="sr-only">Account</Dialog.Title>
        <Dialog.Description className="truncate px-4 pt-4 pb-2 text-muted-foreground text-sm">
          {email}
        </Dialog.Description>
        <ul className="divide-y border-t pb-2">
          <li>
            <Link
              to="/categories"
              onClick={() => setOpen(false)}
              className={ROW_CLASS}
            >
              <Tags
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4 text-muted-foreground"
              />
              Categories
            </Link>
          </li>
          <li>
            <button
              type="button"
              disabled={isPending}
              onClick={signOut}
              className={ROW_CLASS}
            >
              <LogOut
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4 text-muted-foreground"
              />
              {isPending ? "Signing out…" : "Sign out"}
            </button>
          </li>
        </ul>
      </SheetPortal>
    </Dialog.Root>
  );
}
