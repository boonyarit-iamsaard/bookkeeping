"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogOut } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/core/auth/client";
import { resetSessionCache } from "@/core/auth/session";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

interface AccountMenuProps {
  email: string;
}

/**
 * The header's account control: who is signed in and the way out. One
 * capsule trigger holds an initial disc, the email from 640px, and a chevron;
 * the menu repeats the full email so signing out on a phone, where the
 * header cannot show it, still names the account it ends.
 */
export function AccountMenu({ email }: Readonly<AccountMenuProps>) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const initial = email.trim().charAt(0).toUpperCase() || "?";

  async function handleSignOut() {
    setIsPending(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          resetSessionCache(queryClient);
          void navigate({ to: "/sign-in" });
        },
        onError: () => {
          setIsPending(false);
        },
      },
    });
  }

  // A 36px circle below 640px so the header fits a 360px phone; the email
  // joins the capsule from there and truncates before it can push the nav.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        aria-label={isPending ? "Signing out…" : `Account: ${email}`}
        render={
          <Button
            variant="outline"
            className="max-w-64 gap-2 pr-2.5 pl-1 max-sm:size-9 max-sm:p-0"
          />
        }
      >
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-foreground text-sm"
        >
          {initial}
        </span>
        <span className="truncate text-muted-foreground max-sm:hidden">
          {isPending ? "Signing out…" : email}
        </span>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.75}
          className="text-muted-foreground max-sm:hidden"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block text-muted-foreground text-xs">
              Signed in as
            </span>
            <span className="block font-medium text-foreground">{email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut strokeWidth={1.75} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
