import { createLink, Link } from "@tanstack/react-router";
import { AppMark } from "@/core/shell/app-mark";
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
    <header className="sticky top-0 z-20 border-b bg-chrome/90 backdrop-blur-md max-sm:hidden">
      <div className="mx-auto flex h-16 w-full max-w-2xl items-center gap-3 px-4 md:gap-5 lg:max-w-5xl lg:px-6">
        <WordmarkLink
          to="/"
          className="flex shrink-0 items-center gap-2.5 rounded-md font-bold text-[1.0625rem] tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
        >
          <AppMark className="size-8" />
          <span className="max-md:sr-only">Bookkeeping</span>
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
