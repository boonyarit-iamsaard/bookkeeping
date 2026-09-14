"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "cn";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import type * as React from "react";

function DropdownMenu({ ...props }: Readonly<MenuPrimitive.Root.Props>) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({
  ...props
}: Readonly<MenuPrimitive.Portal.Props>) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({
  ...props
}: Readonly<MenuPrimitive.Trigger.Props>) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

interface DropdownMenuContentProps
  extends MenuPrimitive.Popup.Props,
    Pick<
      MenuPrimitive.Positioner.Props,
      "align" | "alignOffset" | "side" | "sideOffset"
    > {}

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}: Readonly<DropdownMenuContentProps>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            // The menu is the one floating surface: a 14px-corner Paper box on
            // a hairline, lifted by a soft offset shadow, entering with a 2px
            // slide and fade that collapses under prefers-reduced-motion.
            "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-closed:fade-out-0 data-open:fade-in-0 z-50 max-h-(--available-height) min-w-56 origin-(--transform-origin) overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border bg-popover p-1 text-popover-foreground shadow-[0_2px_4px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] outline-none duration-150 ease-out [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] data-closed:animate-out data-open:animate-in data-closed:overflow-hidden motion-reduce:animate-none motion-reduce:transition-none",
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({ ...props }: Readonly<MenuPrimitive.Group.Props>) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

interface DropdownMenuLabelProps extends MenuPrimitive.GroupLabel.Props {
  inset?: boolean;
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: Readonly<DropdownMenuLabelProps>) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "wrap-break-word px-3 py-2.5 text-muted-foreground text-sm data-inset:pl-10",
        className,
      )}
      {...props}
    />
  );
}

interface DropdownMenuItemProps extends MenuPrimitive.Item.Props {
  inset?: boolean;
  variant?: "default" | "destructive";
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: Readonly<DropdownMenuItemProps>) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item relative flex min-h-10 cursor-default select-none items-center gap-3 rounded-lg px-3 py-2 font-medium text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-inset:pl-10 data-[variant=destructive]:text-destructive data-disabled:opacity-50 data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-[variant=destructive]:[&_svg]:text-destructive",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSub({
  ...props
}: Readonly<MenuPrimitive.SubmenuRoot.Props>) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

interface DropdownMenuSubTriggerProps
  extends MenuPrimitive.SubmenuTrigger.Props {
  inset?: boolean;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: Readonly<DropdownMenuSubTriggerProps>) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-xl px-3 py-2 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-open:bg-accent data-popup-open:bg-accent data-inset:pl-9.5 data-open:text-accent-foreground data-popup-open:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: Readonly<React.ComponentProps<typeof DropdownMenuContent>>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 w-auto min-w-36 rounded-2xl bg-popover p-1 text-popover-foreground shadow-2xl ring-1 ring-foreground/5 duration-100 data-closed:animate-out data-open:animate-in",
        className,
      )}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

interface DropdownMenuCheckboxItemProps
  extends MenuPrimitive.CheckboxItem.Props {
  inset?: boolean;
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: Readonly<DropdownMenuCheckboxItemProps>) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2.5 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-disabled:pointer-events-none data-inset:pl-9.5 data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({
  ...props
}: Readonly<MenuPrimitive.RadioGroup.Props>) {
  return (
    <MenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

interface DropdownMenuRadioItemProps extends MenuPrimitive.RadioItem.Props {
  inset?: boolean;
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: Readonly<DropdownMenuRadioItemProps>) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2.5 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-disabled:pointer-events-none data-inset:pl-9.5 data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: Readonly<MenuPrimitive.Separator.Props>) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: Readonly<React.ComponentProps<"span">>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-muted-foreground text-xs tracking-widest group-focus/dropdown-menu-item:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
