import { cn } from "@/shared/helpers/cn";

interface DashboardCardProps {
  /** Labels the card's region. */
  headingId: string;
  heading: React.ReactNode;
  /** A quiet link or label at the heading's end, such as "All transactions →". */
  action?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * A desktop dashboard card: its heading and action on one line, the content
 * beneath. It fills its cell in a `DashboardRow`; content that should sit at
 * the card's foot takes `mt-auto`.
 */
export function DashboardCard({
  headingId,
  heading,
  action,
  children,
}: Readonly<DashboardCardProps>) {
  return (
    <section
      aria-labelledby={headingId}
      className="bg-card shadow-card flex flex-col gap-4 rounded-2xl p-6"
    >
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 id={headingId} className="text-lg font-bold tracking-tight">
          {heading}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A desktop table's card: the table's own header row is its top. */
export function TableCard({
  className,
  children,
}: Readonly<{ className?: string; children: React.ReactNode }>) {
  return (
    <div className={cn("bg-card shadow-card rounded-2xl px-6 pb-2", className)}>
      {children}
    </div>
  );
}
