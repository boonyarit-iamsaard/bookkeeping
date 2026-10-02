import { TriangleAlert } from "lucide-react";

interface ConfirmPanelProps {
  /** What the answer will do, said plainly. */
  children: React.ReactNode;
  /** The confirming and the declining button, stacked on phone. */
  actions: React.ReactNode;
}

/**
 * The inline confirmation for a destructive step: a Mist panel led by a
 * triangle-alert, so the warning never rests on red alone, with its answers
 * beneath. Manage and Categories both ask this way.
 */
export function ConfirmPanel({
  children,
  actions,
}: Readonly<ConfirmPanelProps>) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted p-4">
      <p className="flex items-start gap-3 text-foreground text-sm leading-normal">
        <TriangleAlert
          aria-hidden="true"
          strokeWidth={1.75}
          className="mt-0.5 size-4 shrink-0 text-destructive"
        />
        {children}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">{actions}</div>
    </div>
  );
}
