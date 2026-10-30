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
    <div className="bg-muted flex flex-col gap-4 rounded-xl p-4">
      <p className="text-foreground flex items-start gap-3 text-sm leading-normal">
        <TriangleAlert
          aria-hidden="true"
          strokeWidth={1.75}
          className="text-destructive mt-0.5 size-4 shrink-0"
        />
        {children}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">{actions}</div>
    </div>
  );
}
