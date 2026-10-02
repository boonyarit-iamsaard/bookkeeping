import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";
import type * as React from "react";

/**
 * The surface every field-like control shares: input, select, date and month
 * triggers. A 14px-corner white field on a hairline (lifted fill in dark),
 * 44px below 640px and 40px from 640px; focus turns the hairline Iris with a
 * soft ring, and an invalid field turns it red without clearing the value.
 */
export const fieldControlClass =
  "h-11 w-full min-w-0 rounded-lg border border-border bg-card text-base text-foreground outline-none transition-[color,background-color,border-color,box-shadow] duration-150 ease-out placeholder:text-muted-foreground hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_14%)] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 data-popup-open:border-ring sm:h-10 md:text-sm dark:bg-input motion-reduce:transition-none";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        fieldControlClass,
        "px-3.5 py-1 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
