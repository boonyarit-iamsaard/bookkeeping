import { Link } from "@tanstack/react-router";
import { DESTINATIONS } from "@/core/shell/destinations";
import { NavLink } from "@/core/shell/nav-link";
import { buttonVariants } from "@/shared/components/ui/button";

interface AppHeaderProps {
  /** The account control the signed-in layout supplies; the shell owns no feature. */
  accountMenu: React.ReactNode;
}

/** The desktop header from 640px; below it the tab bar and title bar take over. */
export function AppHeader({ accountMenu }: Readonly<AppHeaderProps>) {
  return (
    <header className="border-b bg-background max-sm:hidden">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-4 md:gap-6">
        <Link
          to="/"
          className="font-semibold tracking-tight outline-none focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Bookkeeping
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1">
          {DESTINATIONS.map((destination) => (
            <NavLink key={destination.to} to={destination.to}>
              {destination.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <Link
            to="/transactions/new"
            className={buttonVariants({ size: "lg" })}
          >
            New transaction
          </Link>
          {accountMenu}
        </div>
      </div>
    </header>
  );
}
