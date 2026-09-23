import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { Destination } from "@/core/shell/destinations";
import { DESTINATIONS } from "@/core/shell/destinations";

// Capture sits in the centre, however many destinations flank it.
const CENTRE = Math.ceil(DESTINATIONS.length / 2);

interface TabItemProps {
  destination: Destination;
}

function TabItem({ destination }: Readonly<TabItemProps>) {
  const Icon = destination.icon;
  return (
    <li className="flex flex-auto justify-center">
      <Link
        to={destination.to}
        className="flex min-w-14 flex-col items-center justify-end gap-0.5 rounded-lg px-1 pb-1.5 font-medium text-muted-foreground text-sm leading-snug outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[status=active]:text-foreground"
      >
        <Icon aria-hidden="true" strokeWidth={1.75} className="size-6" />
        {destination.label}
      </Link>
    </li>
  );
}

/**
 * The phone's navigation, fixed in the thumb zone: four destinations with
 * capture as the centre ＋. Current is Ink and the rest Graphite; the link's
 * own `aria-current` marks it, with no pill, underline or cobalt.
 */
export function TabBar() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-backdrop-filter:bg-background/80 sm:hidden"
    >
      <ul className="mx-auto flex h-14 w-full max-w-2xl items-stretch px-1">
        {DESTINATIONS.slice(0, CENTRE).map((destination) => (
          <TabItem key={destination.to} destination={destination} />
        ))}
        <li className="flex flex-auto justify-center">
          {/* The circle rises above the bar so its word lines up with the others. */}
          <Link
            to="/transactions/new"
            className="group flex flex-col items-center justify-end gap-0.5 pb-1.5 font-medium text-muted-foreground text-sm leading-snug outline-none"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50">
              <Plus aria-hidden="true" strokeWidth={1.75} className="size-6" />
            </span>
            New
          </Link>
        </li>
        {DESTINATIONS.slice(CENTRE).map((destination) => (
          <TabItem key={destination.to} destination={destination} />
        ))}
      </ul>
    </nav>
  );
}
