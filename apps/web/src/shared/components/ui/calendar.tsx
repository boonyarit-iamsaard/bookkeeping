"use client";

import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type * as React from "react";
import { useEffect, useRef } from "react";
import type { Chevron, DayButton, Root } from "react-day-picker";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { Button, buttonVariants } from "@/shared/components/ui/button";

/**
 * One month of days as a grid of 40px circles: the caption reads
 * "September 2026" between two ghost arrows, today sits on a Mist disc, and
 * the chosen day is the one Cobalt fill. Sized for a thumb on a phone; the
 * same grid on desktop.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = false,
  components,
  ...props
}: Readonly<React.ComponentProps<typeof DayPicker>>) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "group/calendar w-fit p-3 [--cell-size:--spacing(10)]",
        className,
      )}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-4", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-3", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "size-(--cell-size) select-none p-0 text-muted-foreground hover:text-foreground aria-disabled:opacity-50",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "size-(--cell-size) select-none p-0 text-muted-foreground hover:text-foreground aria-disabled:opacity-50",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption,
        ),
        caption_label: cn(
          "select-none font-medium text-sm",
          defaultClassNames.caption_label,
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 select-none font-normal text-muted-foreground text-xs",
          defaultClassNames.weekday,
        ),
        week: cn("mt-1 flex w-full", defaultClassNames.week),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none rounded-full p-0 text-center",
          defaultClassNames.day,
        ),
        today: cn(
          "rounded-full bg-muted text-foreground",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled,
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      // biome-ignore-start lint/style/useNamingConvention: react-day-picker names its component slots in PascalCase.
      components={{
        Root: CalendarRoot,
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
        ...components,
      }}
      // biome-ignore-end lint/style/useNamingConvention: react-day-picker slots.
      {...props}
    />
  );
}

function CalendarRoot({
  className,
  rootRef,
  ...props
}: Readonly<React.ComponentProps<typeof Root>>) {
  return (
    <div
      data-slot="calendar"
      ref={rootRef}
      className={cn(className)}
      {...props}
    />
  );
}

function CalendarChevron({
  className,
  orientation,
  ...props
}: Readonly<React.ComponentProps<typeof Chevron>>) {
  const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
  return (
    <Icon strokeWidth={1.75} className={cn("size-4", className)} {...props} />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: Readonly<React.ComponentProps<typeof DayButton>>) {
  const defaultClassNames = getDefaultClassNames();

  // Arrow keys move DayPicker's focused day; the button follows.
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) {
      ref.current?.focus();
    }
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected={modifiers.selected}
      className={cn(
        "relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) rounded-full border-0 font-normal text-sm tabular-nums leading-none data-[selected=true]:bg-primary data-[selected=true]:font-medium data-[selected=true]:text-primary-foreground data-[selected=true]:hover:bg-primary data-[selected=true]:hover:text-primary-foreground group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50",
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
