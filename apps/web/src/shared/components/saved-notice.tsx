import { Check } from "lucide-react";
import { cn } from "@/shared/helpers/cn";

interface SavedNoticeProps {
  children: React.ReactNode;
  /** Lets a screen move focus here once the control that had it is gone. */
  ref?: React.Ref<HTMLOutputElement>;
  tabIndex?: number;
  className?: string;
}

/**
 * A change read back as done, in an Iris Tonal card led by a check so the
 * tone is never the only signal. Announced as a status when it appears.
 */
export function SavedNotice({
  children,
  ref,
  tabIndex,
  className,
}: Readonly<SavedNoticeProps>) {
  return (
    <output
      ref={ref}
      tabIndex={tabIndex}
      className={cn(
        "flex items-start gap-3 rounded-2xl bg-secondary px-4 py-3 text-secondary-foreground text-sm leading-normal outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45",
        className,
      )}
    >
      <Check
        aria-hidden="true"
        strokeWidth={2}
        className="mt-0.5 size-4 shrink-0"
      />
      <span>{children}</span>
    </output>
  );
}
