"use client";

import { useNavigate } from "@tanstack/react-router";
import { LogOut, Tags } from "lucide-react";
import { parseAppearance } from "@/core/shell/appearance";
import { APPEARANCE_OPTIONS } from "@/core/shell/appearance-labels";
import { useAppearance } from "@/core/shell/use-appearance";
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

interface AccountMenuProps {
  email: string;
}

/**
 * The desktop account control: who is signed in, the categories they file
 * under, this device's Appearance, and the way out. The trigger is the
 * initial disc alone, so the header keeps room for its destinations and New
 * transaction; the menu names the full email, so signing out still says which
 * account it ends.
 */
export function AccountMenu({ email }: Readonly<AccountMenuProps>) {
  const navigate = useNavigate();
  const { signOut, isPending } = useSignOut();
  const { appearance, setAppearance } = useAppearance();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        aria-label={isPending ? "Signing out…" : accountLabel(email)}
        render={<Button variant="ghost" className="size-10 rounded-full p-0" />}
      >
        <AccountDisc email={email} className="size-9" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block text-muted-foreground text-xs">
              Signed in as
            </span>
            <span className="block break-all font-semibold text-foreground">
              {email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => void navigate({ to: "/categories" })}
          >
            <Tags strokeWidth={1.75} />
            Categories
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {/* Radio items keep the menu open, so the new scheme shows in place. */}
        <DropdownMenuRadioGroup
          value={appearance}
          onValueChange={(value: string) =>
            setAppearance(parseAppearance(value))
          }
        >
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          {APPEARANCE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={signOut}>
            <LogOut strokeWidth={1.75} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
