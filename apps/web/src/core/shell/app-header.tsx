import { createLink, Link } from "@tanstack/react-router";
import type { CaptureLinkSearch } from "@/core/shell/capture-link-search";
import { DESTINATIONS } from "@/core/shell/destinations";
import { NavLink } from "@/core/shell/nav-link";
import { buttonVariants } from "@/shared/components/ui/button";

interface WordmarkAnchorProps extends React.ComponentPropsWithRef<"a"> {}

function WordmarkAnchor({
  "aria-current": _current,
  ...props
}: Readonly<WordmarkAnchorProps>) {
  return <a {...props} />;
}

/** The wordmark leads Home but is not a destination, so it is never current. */
const WordmarkLink = createLink(WordmarkAnchor);

interface AppHeaderProps {
  /** The account control the signed-in layout supplies; the shell owns no feature. */
  accountMenu: React.ReactNode;
  captureSearch: CaptureLinkSearch;
}

/** The desktop header from 640px; below it the tab bar and title bar take over. */
export function AppHeader({
  accountMenu,
  captureSearch,
}: Readonly<AppHeaderProps>) {
  return (
    <header className="border-b bg-background max-sm:hidden">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-4 md:gap-6">
        <WordmarkLink
          to="/"
          className="font-semibold tracking-tight outline-none focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Bookkeeping
        </WordmarkLink>
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
            search={captureSearch}
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
