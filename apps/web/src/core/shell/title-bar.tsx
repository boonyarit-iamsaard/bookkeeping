import { createLink } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/shared/helpers/cn";

interface BackAnchorProps extends React.ComponentPropsWithRef<"a"> {
  /** The glyph alone is not a name; say where back leads. */
  "aria-label": string;
}

function BackAnchor({ className, ...props }: Readonly<BackAnchorProps>) {
  return (
    <a
      {...props}
      className={cn(
        "-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full text-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      <ChevronLeft aria-hidden="true" strokeWidth={1.75} className="size-6" />
    </a>
  );
}

/**
 * The ‹ before a nested screen's title. It names the logical parent, never
 * browser history, so it still leads somewhere after a deep link.
 */
export const BackLink = createLink(BackAnchor);

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

function isPageScrolled() {
  return window.scrollY > 0;
}

interface TitleBarProps {
  title: React.ReactNode;
  /** A `BackLink` on nested screens. */
  back?: React.ReactNode;
  /** Buttons and links at size `touch`, so every action shares one height. */
  actions?: React.ReactNode;
}

/**
 * A screen's title and actions. On phone it is the bar at the top: clear of
 * the status bar, pinned while the page scrolls under it, and ruled only once
 * there is something beneath to separate from. From 640px the desktop header
 * leads, so this is the in-page h1 with the actions beside it.
 */
export function TitleBar({ title, back, actions }: Readonly<TitleBarProps>) {
  const scrolled = useSyncExternalStore(
    subscribeToScroll,
    isPageScrolled,
    () => false,
  );

  return (
    <div
      data-scrolled={scrolled || undefined}
      className="sticky top-0 z-10 -mx-4 flex min-h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 border-transparent border-b bg-background px-4 pt-[env(safe-area-inset-top)] data-scrolled:border-border sm:static sm:mx-0 sm:min-h-0 sm:border-0 sm:px-0 sm:pt-0"
    >
      {back}
      <h1 className="wrap-break-word min-w-0 flex-1 font-semibold text-2xl tracking-tight">
        {title}
      </h1>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
