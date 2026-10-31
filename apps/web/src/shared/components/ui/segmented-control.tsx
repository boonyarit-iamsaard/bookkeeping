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
  /** Added to every segment, for a field whose longest label needs the room. */
  optionClassName?: string;
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
  optionClassName,
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
      // 52px on phone keeps a 4px inset around 44px segments; 44px from 640px.
      className={cn(
        "bg-muted relative grid h-13 rounded-lg p-1 sm:h-11",
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      <span
        aria-hidden="true"
        className="bg-card shadow-card dark:bg-popover ease-out-expo pointer-events-none absolute inset-y-1 left-1 rounded-[0.625rem] transition-transform duration-200 motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${selectedIndex * 100}%)`,
        }}
      />
      {options.map((option) => (
        <Radio.Root
          key={option.value}
          value={option.value}
          className={cn(
            "text-muted-foreground focus-visible:ring-ring/45 data-checked:text-foreground relative z-10 flex items-center justify-center rounded-[0.625rem] px-2 text-sm font-semibold whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-[3px] motion-reduce:transition-none",
            optionClassName,
          )}
        >
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
