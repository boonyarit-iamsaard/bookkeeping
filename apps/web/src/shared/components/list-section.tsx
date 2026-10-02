import { cn } from "@/shared/helpers/cn";

interface ListSectionProps {
  /** Labels the section; the heading sits on the ground above the card. */
  headingId: string;
  heading: React.ReactNode;
  /** A quiet link at the heading's end, such as "All transactions →". */
  action?: React.ReactNode;
  children: React.ReactNode;
  /** 3 when the sections sit inside a region that already has its own h2. */
  level?: 2 | 3;
  className?: string;
}

/**
 * A titled group of rows: the heading on the ground, the rows on one white
 * card beneath it. The rows themselves bring the card (`listCardClass`), so
 * an empty group can show plain text instead.
 */
export function ListSection({
  headingId,
  heading,
  action,
  children,
  level = 2,
  className,
}: Readonly<ListSectionProps>) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex min-h-11 items-center justify-between gap-3 pl-1">
        <Heading
          id={headingId}
          className="font-bold text-[1.0625rem] tracking-tight sm:text-lg"
        >
          {heading}
        </Heading>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The card a group of rows sits on, divided by inset hairlines. */
export const listCardClass =
  "overflow-hidden rounded-2xl bg-card shadow-card divide-y divide-border/70";

/** A quiet text link at a section heading's end, with a 44px target. */
export const sectionLinkClass =
  "-mr-1.5 inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-md px-1.5 font-semibold text-link text-sm outline-none hover:underline hover:underline-offset-4 focus-visible:ring-[3px] focus-visible:ring-ring/45";
