"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "cn";
import type * as React from "react";

function Popover({ ...props }: Readonly<PopoverPrimitive.Root.Props>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  ...props
}: Readonly<PopoverPrimitive.Trigger.Props>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

interface PopoverContentProps
  extends PopoverPrimitive.Popup.Props,
    Pick<
      PopoverPrimitive.Positioner.Props,
      "align" | "alignOffset" | "side" | "sideOffset" | "collisionPadding"
    > {}

function PopoverContent({
  className,
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 8,
  collisionPadding = 16,
  ...props
}: Readonly<PopoverContentProps>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            // The same floating surface as the Select list and the dropdown
            // menu: a 14px-corner Paper box on a hairline with one soft offset
            // shadow, entering with a short slide and fade that collapses
            // under reduced motion.
            "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-closed:fade-out-0 data-open:fade-in-0 z-50 flex origin-(--transform-origin) flex-col rounded-xl border bg-popover text-popover-foreground shadow-[0_2px_4px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] outline-none duration-150 ease-out data-closed:animate-out data-open:animate-in motion-reduce:animate-none motion-reduce:transition-none",
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader({
  className,
  ...props
}: Readonly<React.ComponentProps<"div">>) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-1 text-sm", className)}
      {...props}
    />
  );
}

function PopoverTitle({
  className,
  ...props
}: Readonly<PopoverPrimitive.Title.Props>) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("font-medium text-base", className)}
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: Readonly<PopoverPrimitive.Description.Props>) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
