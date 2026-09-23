"use client";

import { useNavigate } from "@tanstack/react-router";
import { LogOut, Tags } from "lucide-react";
import {
  AccountDisc,
  accountLabel,
} from "@/features/auth/components/account-disc";
import { useSignOut } from "@/features/auth/hooks/use-sign-out";
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
 * The desktop account control: who is signed in, the categories they file
 * under, and the way out. The trigger is the initial disc alone, so the
 * header keeps room for its destinations and New transaction; the menu names
 * the full email, so signing out still says which account it ends.
 */
export function AccountMenu({ email }: Readonly<AccountMenuProps>) {
  const navigate = useNavigate();
  const { signOut, isPending } = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        aria-label={isPending ? "Signing out…" : accountLabel(email)}
        render={<Button variant="outline" className="size-9 p-0" />}
      >
        <AccountDisc email={email} className="size-7" />
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
          <DropdownMenuItem
            onClick={() => void navigate({ to: "/categories" })}
          >
            <Tags strokeWidth={1.75} />
            Categories
          </DropdownMenuItem>
          <DropdownMenuItem onClick={signOut}>
            <LogOut strokeWidth={1.75} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
