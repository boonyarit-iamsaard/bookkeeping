"use client";

import type { CalendarDate } from "@bookkeeping/domain/dates";
import {
  formatCalendarDate,
  parseCalendarDate,
} from "@bookkeeping/domain/dates";
import { cn } from "cn";
import { CalendarDays, ChevronDown } from "lucide-react";
import type * as React from "react";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Calendar, CalendarDayButton } from "@/shared/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";

/**
 * The calendar library thinks in JS Dates; the app thinks in Bangkok
 * calendar dates. Every crossing goes through these two, at local noon so
 * no zone offset can slide a day.
 */
function toDate(date: CalendarDate): Date {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(2000, month - 1, day, 12);
  result.setFullYear(year);
  return result;
}

function toCalendarDate(date: Date): CalendarDate {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The day button, tagged with its ISO date so tests can address a day. */
function IsoDayButton(
  props: Readonly<React.ComponentProps<typeof CalendarDayButton>>,
) {
  return (
    <CalendarDayButton {...props} data-date={toCalendarDate(props.day.date)} />
  );
}

interface DatePickerProps {
  id: string;
  /** Names a hidden input so a plain GET form submits the chosen date. */
  name?: string;
  value?: CalendarDate;
  defaultValue?: CalendarDate;
  onChange?: (date: CalendarDate) => void;
  onBlur?: () => void;
  /** Today in Asia/Bangkok; the calendar never reads the device clock. */
  today: CalendarDate;
  /** Earliest and latest selectable dates, inclusive. */
  min?: CalendarDate;
  max?: CalendarDate;
  placeholder?: string;
  /** Lets the chosen date be removed again, as a filter needs. */
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

/**
 * A date field shaped like the app's other controls: a 44px capsule that
 * reads "14 Sep 2026" and opens one month of days in the same floating box
 * the Select uses. Picking a day closes the calendar and hands focus back.
 */
export function DatePicker({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  onBlur,
  today,
  min,
  max,
  placeholder = "Choose a date",
  clearable = false,
  disabled = false,
  invalid = false,
  className,
  ...aria
}: Readonly<DatePickerProps>) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue);
  const given = value ?? internal;
  // Keep malformed URL text visible and submittable until a date is chosen.
  const current = given && parseCalendarDate(given).ok ? given : "";

  function commit(next: CalendarDate) {
    setInternal(next);
    onChange?.(next);
    setOpen(false);
  }

  const selected = current ? toDate(current) : undefined;
  const disabledDays = [
    ...(min ? [{ before: toDate(min) }] : []),
    ...(max ? [{ after: toDate(max) }] : []),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name ? <input type="hidden" name={name} value={given} /> : null}
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-labelledby={aria["aria-labelledby"]}
        aria-describedby={aria["aria-describedby"]}
        data-min={min}
        data-max={max}
        onBlur={onBlur}
        className={cn(
          "group/date-trigger flex h-11 w-full min-w-0 items-center gap-2 rounded-4xl border border-input bg-input/30 py-1 pr-4 pl-4 text-left text-base text-foreground outline-none transition-colors hover:bg-input/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 data-popup-open:bg-input/50 md:text-sm [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          className,
        )}
      >
        <CalendarDays
          aria-hidden="true"
          strokeWidth={1.75}
          className="text-muted-foreground"
        />
        <span
          data-slot="date-value"
          className={cn(
            "min-w-0 flex-1 truncate",
            !given && "text-muted-foreground",
          )}
        >
          {current ? formatCalendarDate(current) : given || placeholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.75}
          className="text-muted-foreground transition-transform duration-200 ease-out group-data-popup-open/date-trigger:rotate-180 motion-reduce:transition-none"
        />
      </PopoverTrigger>
      <PopoverContent initialFocus={false} aria-label="Choose a date">
        <Calendar
          mode="single"
          autoFocus
          selected={selected}
          onSelect={(day) => {
            // Re-tapping the chosen day is a clear only where clearing is allowed.
            if (day) {
              commit(toCalendarDate(day));
            } else if (clearable) {
              commit("");
            }
          }}
          today={toDate(today)}
          defaultMonth={selected ?? toDate(max ?? today)}
          startMonth={min ? toDate(min) : undefined}
          endMonth={max ? toDate(max) : undefined}
          disabled={disabledDays}
          // biome-ignore lint/style/useNamingConvention: react-day-picker names its component slots in PascalCase.
          components={{ DayButton: IsoDayButton }}
        />
        {clearable && current ? (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="w-full"
              onClick={() => commit("")}
            >
              Clear date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
