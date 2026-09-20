"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/helpers/cn";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: Readonly<NavLinkProps>) {
  const pathname = usePathname();
  const isCurrent = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
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
