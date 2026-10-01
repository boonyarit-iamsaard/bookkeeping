import { Link } from "@tanstack/react-router";
import type { Destination } from "@/core/shell/destinations";

interface NavLinkProps {
  to: Destination["to"];
  children: React.ReactNode;
}

/** A header destination; the link's own `aria-current` gives it the tonal Iris pill. */
export function NavLink({ to, children }: Readonly<NavLinkProps>) {
  return (
    <Link
      to={to}
      className="inline-flex h-10 items-center rounded-md px-2.5 font-semibold text-muted-foreground text-sm outline-none transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/45 data-[status=active]:bg-secondary data-[status=active]:text-secondary-foreground motion-reduce:transition-none md:px-3"
    >
      {children}
    </Link>
  );
}
