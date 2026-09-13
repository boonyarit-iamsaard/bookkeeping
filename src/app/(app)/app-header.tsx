import Link from "next/link";
import { NavLink } from "@/app/(app)/nav-link";
import { SignOutButton } from "@/features/auth/components/sign-out-button";

interface AppHeaderProps {
  email: string;
}

export function AppHeader({ email }: Readonly<AppHeaderProps>) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-6 px-4">
        <Link
          href="/wallets"
          className="font-semibold tracking-tight outline-none focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Bookkeeping
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1">
          <NavLink href="/wallets">Wallets</NavLink>
          <NavLink href="/transactions">Transactions</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden truncate text-muted-foreground text-sm sm:inline">
            {email}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
