import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { CaptureLinkSearch } from "@/core/shell/capture-link-search";
import type { Destination } from "@/core/shell/destinations";
import { DESTINATIONS } from "@/core/shell/destinations";

// Capture sits in the centre, however many destinations flank it.
const CENTRE = Math.ceil(DESTINATIONS.length / 2);

interface TabItemProps {
  destination: Destination;
}

interface TabHalfProps {
  destinations: readonly Destination[];
}

interface TabBarProps {
  captureSearch: CaptureLinkSearch;
}

function TabItem({ destination }: Readonly<TabItemProps>) {
  const Icon = destination.icon;
  return (
    <Link
      to={destination.to}
      className="group/tab flex min-w-14 flex-col items-center justify-end gap-0.5 rounded-md px-1 pb-1.5 font-semibold text-muted-foreground text-xs leading-snug outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 data-[status=active]:text-link"
    >
      <Icon
        aria-hidden="true"
        strokeWidth={1.75}
        className="size-6 group-data-[status=active]/tab:stroke-[2.25]"
      />
      {destination.label}
    </Link>
  );
}

/** One side of ＋: both sides share the width, and tabs keep their own. */
function TabHalf({ destinations }: Readonly<TabHalfProps>) {
  return (
    <div className="flex min-w-0 flex-1 justify-around">
      {destinations.map((destination) => (
        <TabItem key={destination.to} destination={destination} />
      ))}
    </div>
  );
}

/**
 * The phone's navigation, fixed in the thumb zone: four destinations with
 * capture as the centre ＋. The halves are equal so ＋ sits at the exact
 * centre however wide the labels beside it. Current is Iris with a heavier
 * stroke and the rest muted; the link's own `aria-current` marks it, and the
 * word always names it, so colour is never the only signal.
 */
export function TabBar({ captureSearch }: Readonly<TabBarProps>) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-chrome/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md supports-backdrop-filter:bg-chrome/85 sm:hidden"
    >
      <div className="mx-auto flex h-14 w-full max-w-2xl items-stretch px-1">
        <TabHalf destinations={DESTINATIONS.slice(0, CENTRE)} />
        {/* The circle rises above the bar so its word lines up with the others.
            Its name starts with that word so voice control still finds it. */}
        <Link
          to="/transactions/new"
          search={captureSearch}
          aria-label="New transaction"
          className="group flex shrink-0 flex-col items-center justify-end gap-0.5 px-1 pb-1.5 font-semibold text-muted-foreground text-xs leading-snug outline-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_18px_-8px_var(--primary)] ring-4 ring-chrome group-hover:bg-[color-mix(in_oklch,var(--primary),black_12%)] group-focus-visible:ring-ring/45">
            <Plus aria-hidden="true" strokeWidth={2.25} className="size-6" />
          </span>
          <span>New</span>
        </Link>
        <TabHalf destinations={DESTINATIONS.slice(CENTRE)} />
      </div>
    </nav>
  );
}
