import { Hash } from "lucide-react";
import { cn } from "@/shared/helpers/cn";

interface TagChipProps {
  name: string;
  className?: string;
  /** Cuts a long name short on one line, for a table cell that may not grow. */
  truncate?: boolean;
  /** "table": 20px tall at 12px, for desktop table rows. */
  size?: "default" | "table";
}

/** The pill's text size, shared with a table's "+N" chip. */
export const TAG_CHIP_TEXT = {
  default: "text-[0.8125rem] leading-5",
  table: "text-xs leading-4",
} as const;

/**
 * A tag read back: a Mist pill led by a Slate #, never a hue, because hue
 * identifies categories and a tag is not one. Names wrap inside the pill
 * rather than truncating, so "Hay Day diamonds" is never cut to "Hay D…",
 * except in a table, whose rows stay one line.
 */
export function TagChip({
  name,
  className,
  truncate = false,
  size = "default",
}: Readonly<TagChipProps>) {
  return (
    <span
      className={cn(
        "bg-muted text-foreground inline-flex max-w-full items-start gap-1 rounded-full py-0.5 pr-2.5 pl-2 font-medium",
        TAG_CHIP_TEXT[size],
        className,
      )}
    >
      <Hash
        aria-hidden="true"
        strokeWidth={2}
        className={cn(
          "text-muted-foreground shrink-0",
          size === "table" ? "mt-0.5 size-3" : "mt-[0.1875rem] size-3.5",
        )}
      />
      <span
        className={cn("min-w-0", truncate ? "truncate" : "wrap-break-word")}
      >
        {name}
      </span>
    </span>
  );
}

interface TagChipListProps {
  tags: readonly { id: string; name: string }[];
  /** The list's accessible name; rows say whose tags these are. */
  label?: string;
  className?: string;
}

/** A transaction's tags as a wrapping row of chips, in the API's name order. */
export function TagChipList({
  tags,
  label = "Tags",
  className,
}: Readonly<TagChipListProps>) {
  if (tags.length === 0) {
    return null;
  }
  return (
    <ul aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map((tag) => (
        <li key={tag.id} className="flex max-w-full">
          <TagChip name={tag.name} />
        </li>
      ))}
    </ul>
  );
}
