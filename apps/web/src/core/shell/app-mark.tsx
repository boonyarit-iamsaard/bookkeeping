import { cn } from "@/shared/helpers/cn";

interface AppMarkProps {
  className?: string;
}

/** The app icon's mark, drawn small beside the wordmark; decorative. */
export function AppMark({ className }: Readonly<AppMarkProps>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 512 512"
      className={cn("shrink-0", className)}
    >
      <rect width="512" height="512" rx="116" fill="#242047" />
      <rect x="125" y="107" width="56" height="298" rx="28" fill="#ffffff" />
      <circle
        cx="265"
        cy="283"
        r="96"
        fill="none"
        stroke="#ffffff"
        strokeWidth="52"
      />
      <circle cx="265" cy="283" r="38" fill="#9d8cff" />
    </svg>
  );
}
