import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { createLink, Link } from "@tanstack/react-router";
import { AppMark } from "@/core/shell/app-mark";
import type { CaptureLinkSearch } from "@/core/shell/capture-link-search";
import type { Destination } from "@/core/shell/destinations";
import {
  DESTINATIONS,
  MANAGEMENT_DESTINATIONS,
} from "@/core/shell/destinations";
import { useIsWide } from "@/core/shell/use-is-wide";
import { buttonVariants } from "@/shared/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/shared/components/ui/sidebar";
import { openInPlace } from "@/shared/helpers/plain-click";
import { useToday } from "@/shared/hooks/use-today";

interface WordmarkAnchorProps extends React.ComponentPropsWithRef<"a"> {}

function WordmarkAnchor({
  "aria-current": _current,
  ...props
}: Readonly<WordmarkAnchorProps>) {
  return <a {...props} />;
}

/** The wordmark leads Home but is not a destination, so it is never current. */
const WordmarkLink = createLink(WordmarkAnchor);

/** Leads Home; choosing it ends a peek over the page, as a destination does. */
function SidebarWordmark() {
  const { closePeek } = useSidebar();
  return (
    <WordmarkLink
      to="/"
      onClick={closePeek}
      className="focus-visible:ring-ring/45 flex items-center gap-2.5 rounded-md text-[1.0625rem] font-bold tracking-tight outline-none focus-visible:ring-[3px]"
    >
      <AppMark className="size-8 shrink-0" />
      <span className="group-data-[collapsible=icon]:sr-only">Bookkeeping</span>
    </WordmarkLink>
  );
}

interface SidebarGroupLinksProps {
  destinations: readonly Destination[];
}

function SidebarGroupLinks({ destinations }: Readonly<SidebarGroupLinksProps>) {
  // Choosing a destination ends a peek over the page.
  const { closePeek } = useSidebar();
  return (
    <SidebarGroup>
      <SidebarMenu>
        {destinations.map(({ to, label, icon: Icon }) => (
          <SidebarMenuItem key={to}>
            <SidebarMenuButton
              tooltip={label}
              render={
                <Link
                  to={to}
                  activeOptions={{ exact: to === "/" }}
                  onClick={closePeek}
                />
              }
            >
              <Icon aria-hidden="true" strokeWidth={1.75} />
              <span>{label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

interface DesktopShellProps {
  /** The account control the signed-in layout supplies; the shell owns no feature. */
  accountMenu: React.ReactNode;
  captureSearch: CaptureLinkSearch;
  /** Opens New transaction over the current screen instead of navigating. */
  onNewTransaction?: () => void;
  /** Leaves New transaction to a screen that puts it on its own title row. */
  hideNewTransaction?: boolean;
  children: React.ReactNode;
}

/**
 * The signed-in app from 1024px: a sidebar that collapses to its icons, and a
 * top bar with today's date, New transaction and the account control. Below
 * 1024px the tab bar and title bar take over. Screens keep their own `main`,
 * so the content column here is a plain wrapper.
 */
export function DesktopShell({
  accountMenu,
  captureSearch,
  onNewTransaction,
  hideNewTransaction,
  children,
}: Readonly<DesktopShellProps>) {
  const today = useToday();
  const wide = useIsWide();
  return (
    <SidebarProvider overlay={!wide}>
      <Sidebar data-shell="sidebar">
        <SidebarHeader className="h-16 justify-center px-3">
          <SidebarWordmark />
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Primary">
            <SidebarGroupLinks destinations={DESTINATIONS} />
            <SidebarGroupLinks destinations={MANAGEMENT_DESTINATIONS} />
          </nav>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <div className="flex min-w-0 flex-1 flex-col">
        {/*
         * The trigger keeps the window's left edge; the rest lines up with
         * the 96rem content column inside its 32px gutters, and clears the
         * trigger when the column is wider than the window.
         */}
        <header
          data-shell="header"
          className="bg-chrome/90 sticky top-0 z-20 flex h-16 items-center gap-3 border-b pr-[max(2rem,calc((100%-96rem)/2+2rem))] pl-[max(4.5rem,calc((100%-96rem)/2+2rem))] backdrop-blur-md"
        >
          <SidebarTrigger className="absolute top-1/2 left-4 -translate-y-1/2" />
          <p className="text-muted-foreground text-sm font-medium">
            Today · {formatCalendarDate(today)}
          </p>
          <div className="ml-auto flex items-center gap-2">
            {!hideNewTransaction && (
              <Link
                to="/transactions/new"
                search={captureSearch}
                onClick={openInPlace(onNewTransaction)}
                className={buttonVariants({ size: "lg" })}
              >
                New transaction
              </Link>
            )}
            {accountMenu}
          </div>
        </header>
        {children}
      </div>
    </SidebarProvider>
  );
}
