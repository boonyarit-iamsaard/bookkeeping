import { Check } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/shared/helpers/cn";

interface SavedNoticeProps {
  children: React.ReactNode;
  /**
   * Takes focus each time a new object is passed, even when the message
   * repeats, for when the control that had it is gone.
   */
  takeFocusOn?: object;
  className?: string;
}

/**
 * A change read back as done, in an Iris Tonal card led by a check so the
 * tone is never the only signal. Announced as a status when it appears.
 */
export function SavedNotice({
  children,
  takeFocusOn,
  className,
}: Readonly<SavedNoticeProps>) {
  const ref = useRef<HTMLOutputElement>(null);

  useEffect(() => {
    if (takeFocusOn) {
      ref.current?.focus();
    }
  }, [takeFocusOn]);

  return (
    <output
      ref={ref}
      tabIndex={takeFocusOn ? -1 : undefined}
      className={cn(
        "bg-secondary text-secondary-foreground focus-visible:ring-ring/45 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm leading-normal outline-none focus-visible:ring-[3px]",
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
