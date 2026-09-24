"use client";

import { cn } from "cn";
import {
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_NAMES_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const CALENDAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function isCalendarMonth(value: string): boolean {
  return CALENDAR_MONTH_PATTERN.test(value) && Number(value.slice(0, 4)) > 0;
}

function yearOf(month: string): number {
  return Number(month.slice(0, 4));
}

function toCalendarMonth(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/** "2026-09" → "September 2026". */
function formatCalendarMonth(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  return `${MONTH_NAMES_LONG[index] ?? month} ${yearOf(month)}`;
}

interface MonthPickerProps {
  id: string;
  /** Names a hidden input so a plain GET form submits the chosen month. */
  name?: string;
  /** A calendar month in ISO form, YYYY-MM; empty means no selection. */
  value?: string;
  defaultValue?: string;
  onChange?: (month: string) => void;
  /** The current month in Asia/Bangkok; it carries the Mist "now" marker. */
  thisMonth: string;
  /** Earliest and latest selectable months, inclusive. */
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

/**
 * The date picker's sibling for a whole month: the same capsule trigger
 * reading "September 2026", opening a year with its twelve months as pills.
 * Arrows step the year; the current month sits on Mist, the chosen one on
 * Cobalt.
 */
export function MonthPicker({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  thisMonth,
  min,
  max,
  placeholder = "Choose a month",
  disabled = false,
  invalid = false,
  className,
  ...aria
}: Readonly<MonthPickerProps>) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue);
  // A malformed value (a hand-edited URL) reads as no choice at all.
  const given = value ?? internal;
  const current = given && isCalendarMonth(given) ? given : "";
  const [viewYear, setViewYear] = useState(yearOf(current || max || thisMonth));

  function commit(next: string) {
    setInternal(next);
    onChange?.(next);
    setOpen(false);
  }

  function selectable(month: string): boolean {
    return (!min || month >= min) && (!max || month <= max);
  }

  const earlierYear = !min || viewYear > yearOf(min);
  const laterYear = !max || viewYear < yearOf(max);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setViewYear(yearOf(current || max || thisMonth));
        }
        setOpen(next);
      }}
    >
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-labelledby={aria["aria-labelledby"]}
        aria-describedby={aria["aria-describedby"]}
        className={cn(
          "group/month-trigger flex h-11 w-full min-w-0 items-center gap-2 rounded-4xl border border-input bg-input/30 py-1 pr-4 pl-4 text-left text-base text-foreground outline-none transition-colors hover:bg-input/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 data-popup-open:bg-input/50 md:text-sm [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          className,
        )}
      >
        <CalendarRange
          aria-hidden="true"
          strokeWidth={1.75}
          className="text-muted-foreground"
        />
        <span
          data-slot="month-value"
          className={cn(
            "min-w-0 flex-1 truncate",
            !current && "text-muted-foreground",
          )}
        >
          {current ? formatCalendarMonth(current) : placeholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.75}
          className="text-muted-foreground group-data-popup-open/month-trigger:rotate-180"
        />
      </PopoverTrigger>
      <PopoverContent aria-label="Choose a month" className="w-72 p-3">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label="Previous year"
            disabled={!earlierYear}
            onClick={() => setViewYear((year) => year - 1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft strokeWidth={1.75} />
          </Button>
          <span
            aria-live="polite"
            className="select-none font-medium text-sm tabular-nums"
          >
            {viewYear}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label="Next year"
            disabled={!laterYear}
            onClick={() => setViewYear((year) => year + 1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronRight strokeWidth={1.75} />
          </Button>
        </div>
        <fieldset className="mt-2 grid min-w-0 grid-cols-3 gap-1">
          <legend className="sr-only">Months of {viewYear}</legend>
          {MONTH_NAMES.map((label, index) => {
            const month = toCalendarMonth(viewYear, index);
            const selected = month === current;
            return (
              <Button
                key={month}
                type="button"
                variant="ghost"
                size="lg"
                data-month={month}
                aria-label={`${MONTH_NAMES_LONG[index]} ${viewYear}`}
                aria-pressed={selected}
                disabled={!selectable(month)}
                onClick={() => commit(month)}
                className={cn(
                  "font-normal",
                  month === thisMonth && "bg-muted",
                  selected &&
                    "bg-primary font-medium text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                )}
              >
                {label}
              </Button>
            );
          })}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
