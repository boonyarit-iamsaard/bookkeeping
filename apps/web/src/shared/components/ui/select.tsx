"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cn } from "cn";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type * as React from "react";

/**
 * The app's choice control, shaped like its inputs: a 44px capsule trigger
 * and a floating list that drops beneath it in the same 14px-corner box the
 * dropdown menu uses. Value display is the caller's: pass a function child
 * to SelectValue so the trigger can show a compact line while items carry
 * richer content.
 */
const Select = SelectPrimitive.Root;

function SelectGroup({
  className,
  ...props
}: Readonly<SelectPrimitive.Group.Props>) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1", className)}
      {...props}
    />
  );
}

function SelectValue({
  className,
  ...props
}: Readonly<SelectPrimitive.Value.Props>) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn(
        // `w-0` plus grow: the value contributes no intrinsic width, so long
        // labels truncate instead of widening a fieldset past its column.
        "flex w-0 min-w-0 flex-1 items-center gap-2 truncate text-left *:min-w-0",
        className,
      )}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  children,
  ...props
}: Readonly<SelectPrimitive.Trigger.Props>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "group/select-trigger flex h-11 w-full min-w-0 items-center gap-2 rounded-4xl border border-input bg-input/30 py-1 pr-4 pl-4 text-base text-foreground outline-none transition-colors hover:bg-input/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 data-popup-open:bg-input/50 md:text-sm [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
      {/* Base UI's Icon defaults to a "▼" text child; the Lucide chevron replaces it. */}
      <SelectPrimitive.Icon
        render={
          <ChevronDown
            aria-hidden="true"
            strokeWidth={1.75}
            className="text-muted-foreground group-data-popup-open/select-trigger:rotate-180"
          />
        }
      >
        {null}
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 8,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  collisionPadding = 16,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    | "align"
    | "alignOffset"
    | "side"
    | "sideOffset"
    | "alignItemWithTrigger"
    | "collisionPadding"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        collisionPadding={collisionPadding}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            // The same floating surface as the dropdown menu: a 14px-corner
            // Paper box on a hairline with one soft offset shadow, appearing
            // without animating.
            // The popup clips; the List beneath is the scroll container, so
            // Base UI can hide its scrollbar behind the edge arrows and the
            // rounded corners stay closed.
            "relative isolate z-50 flex max-h-[min(var(--available-height),26rem)] w-(--anchor-width) min-w-48 flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-[0_2px_4px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] outline-none",
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 [scrollbar-color:var(--border)_transparent]">
            {children}
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: Readonly<SelectPrimitive.GroupLabel.Props>) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-3 py-2.5 text-muted-foreground text-xs", className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: Readonly<SelectPrimitive.Item.Props>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        // 44px options below 640px; 40px from 640px.
        "relative flex min-h-11 w-full cursor-default select-none items-center gap-3 rounded-lg py-2 pr-10 pl-3 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-highlighted:bg-accent data-selected:font-medium data-highlighted:text-accent-foreground data-disabled:opacity-50 sm:min-h-10 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex min-w-0 flex-1 flex-col text-left">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-3 flex size-4 items-center justify-center text-primary" />
        }
      >
        <Check aria-hidden="true" strokeWidth={2} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: Readonly<SelectPrimitive.Separator.Props>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        // 44px overflow arrows below 640px; 28px from 640px.
        "top-0 z-10 flex h-11 w-full cursor-default items-center justify-center rounded-t-xl bg-linear-to-b from-55% from-popover to-transparent text-muted-foreground sm:h-7 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ChevronUp aria-hidden="true" strokeWidth={1.75} />
    </SelectPrimitive.ScrollUpArrow>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex h-11 w-full cursor-default items-center justify-center rounded-b-xl bg-linear-to-t from-55% from-popover to-transparent text-muted-foreground sm:h-7 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ChevronDown aria-hidden="true" strokeWidth={1.75} />
    </SelectPrimitive.ScrollDownArrow>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
