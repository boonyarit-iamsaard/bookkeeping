import { CircleAlert } from "lucide-react";

interface ErrorNoticeProps {
  children: React.ReactNode;
}

/**
 * A rejection read back in a 10% Signal Red card, led by a pictogram so red
 * is never the only signal. Announced as an alert when it appears.
 */
export function ErrorNotice({ children }: Readonly<ErrorNoticeProps>) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl bg-destructive/10 px-4 py-3 text-destructive text-sm leading-normal"
    >
      <CircleAlert
        aria-hidden="true"
        strokeWidth={1.75}
        className="mt-0.5 size-4 shrink-0"
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
