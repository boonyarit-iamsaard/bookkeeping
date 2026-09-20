import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/shared/helpers/cn";

interface NavLinkProps {
  // Widened until the ported routes register these paths (tickets 05 to 11).
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: Readonly<NavLinkProps>) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const isCurrent = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      to={href}
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        "rounded-4xl px-2 py-1.5 font-medium text-sm outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:px-3",
        isCurrent ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </Link>
  );
}
