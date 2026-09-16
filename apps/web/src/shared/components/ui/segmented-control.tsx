"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { cn } from "@/shared/helpers/cn";

export interface SegmentedOption<Value extends string> {
  value: Value;
  label: string;
}

export interface SegmentedControlProps<Value extends string> {
  options: readonly SegmentedOption<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  name?: string;
  "aria-labelledby"?: string;
  className?: string;
}

/**
 * A single-choice segmented control: radio semantics and arrow-key movement
 * from Base UI, with one sliding indicator behind the selected segment.
 */
export function SegmentedControl<Value extends string>({
  options,
  value,
  onValueChange,
  name,
  className,
  "aria-labelledby": ariaLabelledBy,
}: Readonly<SegmentedControlProps<Value>>) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <RadioGroup
      name={name}
      value={value}
      onValueChange={(next) => onValueChange(next)}
      aria-labelledby={ariaLabelledBy}
      className={cn("relative grid h-11 rounded-4xl bg-muted p-1", className)}
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-1 left-1 rounded-4xl bg-background shadow-[0_1px_2px_rgba(0,0,0,0.08),0_1px_6px_rgba(0,0,0,0.06)] transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${selectedIndex * 100}%)`,
        }}
      />
      {options.map((option) => (
        <Radio.Root
          key={option.value}
          value={option.value}
          className="relative z-10 flex items-center justify-center rounded-4xl px-2 font-medium text-muted-foreground text-sm outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-checked:text-primary motion-reduce:transition-none"
        >
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
