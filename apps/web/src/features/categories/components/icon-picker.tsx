"use client";

import { ChevronDown } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { suggestIcons } from "@/features/categories/icon-suggestions";
import type { IconDefinition } from "@/features/categories/icons";
import {
  ICON_GROUPS,
  iconDefinition,
  iconsInGroup,
} from "@/features/categories/icons";
import { cn } from "@/shared/helpers/cn";

interface IconPickerProps {
  /** The category name the recommendations follow. */
  name: string;
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
        className="flex flex-wrap gap-2"
      >
        {shortlist.map((icon) => (
          <IconChoice
            key={icon.id}
            icon={icon}
            groupName={groupName}
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
      <button
        type="button"
        aria-expanded={browsing}
        aria-controls={browseId}
        disabled={disabled}
        onClick={() => setBrowsing((open) => !open)}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-4xl px-3 font-medium text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
      >
        {browsing ? "Hide all icons" : "Browse all icons"}
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.75}
          className={cn("size-4", browsing && "rotate-180")}
        />
      </button>
      {browsing && (
        <div
          id={browseId}
          role="radiogroup"
          aria-label="All icons"
          className="flex flex-col gap-4"
        >
          {ICON_GROUPS.map((group) => (
            <section
              key={group.id}
              aria-label={group.label}
              className="flex flex-col gap-2"
            >
              <h4 className="font-medium text-muted-foreground text-sm">
                {group.label}
              </h4>
              <div className="flex flex-wrap gap-2">
                {iconsInGroup(group.id).map((icon) => (
                  <IconChoice
                    key={icon.id}
                    icon={icon}
                    groupName={browseGroupName}
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
  checked: boolean;
  disabled?: boolean;
  onPick: (iconId: string) => void;
}

/**
 * A native radio behind a 44px disc, so arrow keys walk the group and the
 * checked one takes the cobalt selection ring and glyph.
 */
function IconChoice({
  icon,
  groupName,
  checked,
  disabled,
  onPick,
}: Readonly<IconChoiceProps>) {
  const Glyph = icon.glyph;
  const label = iconLabel(icon);
  return (
    <label className="relative block size-11" title={label}>
      <input
        type="radio"
        name={groupName}
        value={icon.id}
        checked={checked}
        disabled={disabled}
        onChange={() => onPick(icon.id)}
        aria-label={label}
        className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none flex size-11 items-center justify-center rounded-full border border-transparent bg-muted text-foreground transition-colors peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:opacity-50 motion-reduce:transition-none",
          checked
            ? "border-primary/40 bg-primary/5 text-primary"
            : "peer-hover:bg-input/60",
        )}
      >
        <Glyph strokeWidth={1.75} className="size-5" />
      </span>
    </label>
  );
}
