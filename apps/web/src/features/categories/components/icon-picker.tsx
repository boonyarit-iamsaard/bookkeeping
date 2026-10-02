"use client";

import { Check, ChevronDown } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { CategoryColor } from "@/features/categories/category-color";
import { suggestIcons } from "@/features/categories/icon-suggestions";
import type { IconDefinition } from "@/features/categories/icons";
import {
  ICON_GROUPS,
  iconDefinition,
  iconsInGroup,
} from "@/features/categories/icons";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/helpers/cn";

interface IconPickerProps {
  /** The category name the recommendations follow. */
  name: string;
  /** The hue the category wears, so the chosen icon previews its tile. */
  color: CategoryColor;
  value: string;
  /** Called only for a pick by hand; recommendations are applied by the owner. */
  onChange: (iconId: string) => void;
  /** Names the group for assistive technology; the visible label sits outside. */
  "aria-labelledby": string;
  "aria-describedby"?: string;
  disabled?: boolean;
}

/** "hand-coins" → "Hand coins": the id is stable, so the name is derived. */
export function iconLabel(icon: IconDefinition): string {
  const words = icon.id.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Up to six local recommendations for the name, the current choice always
 * visible, and every catalog group behind a disclosure. The owner keeps the
 * value on the top recommendation until the user picks one here; when
 * nothing matches it stays generic, so saving is never blocked.
 */
export function IconPicker({
  name,
  color,
  value,
  onChange,
  disabled,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
}: Readonly<IconPickerProps>) {
  const [browsing, setBrowsing] = useState(false);
  const groupName = useId();
  const browseId = `${groupName}-browse`;
  // The catalog is its own radio group: a browser allows one checked radio
  // per name, and the selected icon also sits in the shortlist above.
  const browseGroupName = `${groupName}-all`;
  const suggestions = useMemo(() => suggestIcons(name), [name]);

  const selected = iconDefinition(value);
  // The selection stays visible even when it is not among the suggestions.
  const shortlist = suggestions.some((icon) => icon.id === selected.id)
    ? suggestions
    : [selected, ...suggestions];

  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className="flex flex-wrap gap-2 pt-1.5 pr-1.5"
      >
        {shortlist.map((icon) => (
          <IconChoice
            key={icon.id}
            icon={icon}
            groupName={groupName}
            color={color}
            checked={icon.id === selected.id}
            disabled={disabled}
            onPick={onChange}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-sm leading-normal">
        {suggestions.length > 0
          ? `Recommended for “${name.trim()}”; ${iconLabel(selected)} is selected.`
          : `${iconLabel(selected)} is selected. Browse for a better fit.`}
      </p>
      <Button
        type="button"
        variant="outline"
        className="self-start"
        aria-expanded={browsing}
        aria-controls={browseId}
        disabled={disabled}
        onClick={() => setBrowsing((open) => !open)}
      >
        {browsing ? "Hide all icons" : "Browse all icons"}
        <ChevronDown
          aria-hidden="true"
          data-icon="inline-end"
          strokeWidth={1.75}
          className={cn("size-4", browsing && "rotate-180")}
        />
      </Button>
      {browsing && (
        <div
          id={browseId}
          role="radiogroup"
          aria-label="All icons"
          className="flex flex-col gap-5 pt-1"
        >
          {ICON_GROUPS.map((group) => (
            <section
              key={group.id}
              aria-label={group.label}
              className="flex flex-col gap-2"
            >
              <h4 className="font-semibold text-muted-foreground text-sm">
                {group.label}
              </h4>
              <div className="flex flex-wrap gap-2 pt-1.5 pr-1.5">
                {iconsInGroup(group.id).map((icon) => (
                  <IconChoice
                    key={icon.id}
                    icon={icon}
                    groupName={browseGroupName}
                    color={color}
                    checked={icon.id === selected.id}
                    disabled={disabled}
                    onPick={onChange}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

interface IconChoiceProps {
  icon: IconDefinition;
  groupName: string;
  color: CategoryColor;
  checked: boolean;
  disabled?: boolean;
  onPick: (iconId: string) => void;
}

/**
 * A native radio behind a 44px Mist tile. Arrow keys walk the group; the
 * checked one becomes the category's own tile, in its hue, so it previews
 * the row, and takes an Iris outline and a check badge, so selection is
 * never the hue alone.
 */
function IconChoice({
  icon,
  groupName,
  color,
  checked,
  disabled,
  onPick,
}: Readonly<IconChoiceProps>) {
  const Glyph = icon.glyph;
  const label = iconLabel(icon);
  return (
    <label data-hue={color} className="relative block size-11" title={label}>
      <input
        type="radio"
        name={groupName}
        value={icon.id}
        checked={checked}
        disabled={disabled}
        onChange={() => onPick(icon.id)}
        aria-label={label}
        className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-lg disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none flex size-11 items-center justify-center rounded-lg transition-[background-color,color] duration-150 ease-out peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/45 peer-disabled:opacity-50 motion-reduce:transition-none",
          checked
            ? "hue-tile outline-2 outline-primary outline-offset-2"
            : "bg-muted text-foreground peer-hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_6%)]",
        )}
      >
        <Glyph strokeWidth={1.75} className="size-5" />
      </span>
      {checked && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-1.5 -right-1.5 flex size-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card"
        >
          <Check strokeWidth={3} className="size-3" />
        </span>
      )}
    </label>
  );
}
