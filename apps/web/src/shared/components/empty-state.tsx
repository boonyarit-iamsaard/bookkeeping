import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  headingId: string;
  title: string;
  /** What fills this place once there is something, and how it gets there. */
  description: React.ReactNode;
  /** The one next step, usually a primary link. */
  action?: React.ReactNode;
}

/**
 * A place with nothing in it yet: a card leading with a tonal Iris tile,
 * the title, a sentence that teaches what belongs here, and the next step.
 */
export function EmptyState({
  icon: Icon,
  headingId,
  title,
  description,
  action,
}: Readonly<EmptyStateProps>) {
  return (
    <section
      aria-labelledby={headingId}
      className="bg-card shadow-card flex flex-col items-start gap-4 rounded-2xl p-5 sm:p-7"
    >
      <span className="bg-secondary text-secondary-foreground flex size-12 items-center justify-center rounded-lg">
        <Icon aria-hidden="true" strokeWidth={2} className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 id={headingId} className="text-lg font-bold tracking-tight">
          {title}
        </h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-normal">
          {description}
        </p>
      </div>
      {action}
    </section>
  );
}
