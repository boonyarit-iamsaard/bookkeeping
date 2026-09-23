import { Link } from "@tanstack/react-router";
import type { DESTINATIONS } from "@/core/shell/destinations";

interface NavLinkProps {
  to: (typeof DESTINATIONS)[number]["to"];
  children: React.ReactNode;
}

/** A header capsule; the link's own `aria-current` turns it Ink. */
export function NavLink({ to, children }: Readonly<NavLinkProps>) {
  return (
    <Link
      to={to}
      className="rounded-4xl px-2 py-1.5 font-medium text-muted-foreground text-sm outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[status=active]:text-foreground md:px-3"
    >
      {children}
    </Link>
  );
}
