"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Tags } from "lucide-react";
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
 * The account control: who is signed in, the categories they file under,
 * and the way out. The trigger is
 * the initial disc alone, so the header keeps room for its destinations and
 * New transaction; the menu names the full email, so signing out still says
 * which account it ends.
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        aria-label={isPending ? "Signing out…" : `Account: ${email}`}
        render={<Button variant="outline" className="size-9 p-0" />}
      >
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-foreground text-sm"
        >
          {initial}
        </span>
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
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut strokeWidth={1.75} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
