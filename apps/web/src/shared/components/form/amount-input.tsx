import type * as React from "react";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/helpers/cn";

/**
 * The form's figure: a large baht amount between a ฿ prefix and a THB
 * suffix, both decoration only. Callers bring the field's id, value, and
 * error wiring; the screen's label and description stay with its Field.
 */
export function AmountInput({
  className,
  ...props
}: Readonly<Omit<React.ComponentProps<typeof Input>, "type" | "inputMode">>) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="money pointer-events-none absolute inset-y-0 left-5 flex items-center text-muted-foreground text-xl"
      >
        ฿
      </span>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        className={cn(
          "money h-16 pr-16 pl-11 text-3xl text-foreground sm:h-16 md:text-3xl",
          className,
        )}
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-5 flex items-center font-medium text-muted-foreground text-sm"
      >
        THB
      </span>
    </div>
  );
}
