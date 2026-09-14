import Link from "next/link";
import { NavLink } from "@/app/(app)/nav-link";
import { AccountMenu } from "@/features/auth/components/account-menu";

interface AppHeaderProps {
  email: string;
}

export function AppHeader({ email }: Readonly<AppHeaderProps>) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-2 px-4 sm:gap-6">
        {/* Omitted below 640px so three links and the account menu fit a 360px phone. */}
        <Link
          href="/wallets"
          className="font-semibold tracking-tight outline-none focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 max-sm:hidden"
        >
          Bookkeeping
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1">
          <NavLink href="/wallets">Wallets</NavLink>
          <NavLink href="/transactions">Transactions</NavLink>
          <NavLink href="/categories">Categories</NavLink>
        </nav>
        <div className="ml-auto flex min-w-0 items-center">
          <AccountMenu email={email} />
        </div>
      </div>
    </header>
  );
}
