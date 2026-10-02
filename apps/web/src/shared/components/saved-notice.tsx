import { Check } from "lucide-react";

interface SavedNoticeProps {
  children: React.ReactNode;
}

/**
 * A change read back as done, in an Iris Tonal card led by a check so the
 * tone is never the only signal. Announced as a status when it appears.
 */
export function SavedNotice({ children }: Readonly<SavedNoticeProps>) {
  return (
    <output className="flex items-start gap-3 rounded-2xl bg-secondary px-4 py-3 text-secondary-foreground text-sm leading-normal">
      <Check
        aria-hidden="true"
        strokeWidth={2}
        className="mt-0.5 size-4 shrink-0"
      />
      <span>{children}</span>
    </output>
  );
}
