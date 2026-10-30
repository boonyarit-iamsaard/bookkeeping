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
        "text-foreground hover:bg-accent focus-visible:ring-ring/45 -ml-2 flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px]",
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
  /**
   * Buttons and links at size `lg`, 44px on phone and 40px from 640px. A
   * ghost action pulls right by `-mr-3` so its word, not its invisible
   * padding, meets the column's edge.
   */
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
      className="bg-chrome data-scrolled:border-border sticky top-0 z-10 -mx-4 flex min-h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 border-b border-transparent px-4 pt-[env(safe-area-inset-top)] sm:static sm:mx-0 sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0"
    >
      {back}
      <h1 className="min-w-0 flex-1 text-[1.625rem] leading-tight font-bold tracking-[-0.02em] wrap-break-word sm:text-3xl">
        {title}
      </h1>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
