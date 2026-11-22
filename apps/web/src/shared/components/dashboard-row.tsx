import { cn } from "@/shared/helpers/cn";

interface DashboardRowProps {
  /** The row's columns, such as `lg:grid-cols-3`. */
  className: string;
  children: React.ReactNode;
}

/**
 * A desktop dashboard row: its cards share one height, so a short card
 * stretches to its neighbour. Each child fills its cell, and a wrapper
 * around a card passes the height on with `*:h-full`.
 */
export function DashboardRow({
  className,
  children,
}: Readonly<DashboardRowProps>) {
  return <div className={cn("grid gap-8 *:h-full", className)}>{children}</div>;
}
