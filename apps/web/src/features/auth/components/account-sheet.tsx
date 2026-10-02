"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Link } from "@tanstack/react-router";
import { LogOut, Tags } from "lucide-react";
import { useId, useState } from "react";
import { APPEARANCE_OPTIONS } from "@/core/shell/appearance-labels";
import { useAppearance } from "@/core/shell/use-appearance";
import {
  AccountDisc,
  accountLabel,
} from "@/features/auth/components/account-disc";
import { useSignOut } from "@/features/auth/hooks/use-sign-out";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { SheetHeader, SheetPortal } from "@/shared/components/ui/sheet";

interface AccountSheetProps {
  email: string;
}

const ROW_CLASS =
  "flex min-h-14 w-full items-center gap-3.5 px-4 text-left font-semibold outline-none hover:bg-accent/70 focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:ring-inset disabled:opacity-50";

const ROW_TILE_CLASS =
  "flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-[1.125rem]";

/**
 * The phone account control in Home's title bar: the initial disc opens a
 * sheet naming the signed-in email, then Categories, this device's
 * Appearance, and Sign out. From 640px the header's account menu does this
 * job instead.
 */
export function AccountSheet({ email }: Readonly<AccountSheetProps>) {
  const [open, setOpen] = useState(false);
  const { signOut, isPending } = useSignOut();
  const { appearance, setAppearance } = useAppearance();
  const appearanceLabelId = useId();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label={accountLabel(email)}
        className="-mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <AccountDisc email={email} className="size-8" />
      </Dialog.Trigger>
      <SheetPortal>
        <SheetHeader subtitle={email}>Account</SheetHeader>
        <ul className="mx-4 mb-4 divide-y divide-border/70 overflow-hidden rounded-2xl bg-background sm:mx-6 sm:mb-6">
          <li>
            <Link
              to="/categories"
              onClick={() => setOpen(false)}
              className={ROW_CLASS}
            >
              <span className={ROW_TILE_CLASS}>
                <Tags aria-hidden="true" strokeWidth={2} />
              </span>
              {"Categories"}
            </Link>
          </li>
          <li className="flex flex-col gap-2.5 px-4 py-3.5">
            <span id={appearanceLabelId} className="font-semibold">
              Appearance
            </span>
            <SegmentedControl
              aria-labelledby={appearanceLabelId}
              options={APPEARANCE_OPTIONS}
              value={appearance}
              onValueChange={setAppearance}
            />
          </li>
          <li>
            <button
              type="button"
              disabled={isPending}
              onClick={signOut}
              className={ROW_CLASS}
            >
              <span className={ROW_TILE_CLASS}>
                <LogOut aria-hidden="true" strokeWidth={2} />
              </span>
              {isPending ? "Signing out…" : "Sign out"}
            </button>
          </li>
        </ul>
      </SheetPortal>
    </Dialog.Root>
  );
}
