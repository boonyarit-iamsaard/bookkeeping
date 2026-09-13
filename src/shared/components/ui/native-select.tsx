import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import type * as React from "react";

/**
 * The platform's own select, styled to the pill controls. On phones it opens
 * the native picker, which is the fastest and most accessible option for a
 * one-handed choice among a handful of items.
 */
function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <span className="relative block w-full">
      <select
        data-slot="native-select"
        className={cn(
          "h-11 w-full min-w-0 appearance-none truncate rounded-4xl border border-input bg-input/30 py-1 pr-10 pl-4 text-base text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  );
}

export { NativeSelect };
