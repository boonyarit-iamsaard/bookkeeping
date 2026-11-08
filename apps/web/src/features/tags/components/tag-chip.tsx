import { Hash } from "lucide-react";
import { cn } from "@/shared/helpers/cn";

interface TagChipProps {
  name: string;
  className?: string;
}

/**
 * A tag read back: a Mist pill led by a Slate #, never a hue, because hue
 * identifies categories and a tag is not one. Names wrap inside the pill
 * rather than truncating, so "Hay Day diamonds" is never cut to "Hay D…".
 */
export function TagChip({ name, className }: Readonly<TagChipProps>) {
  return (
    <span
      className={cn(
        "bg-muted text-foreground inline-flex max-w-full items-start gap-1 rounded-full py-0.5 pr-2.5 pl-2 text-[0.8125rem] leading-5 font-medium",
        className,
      )}
    >
      <Hash
        aria-hidden="true"
        strokeWidth={2}
        className="text-muted-foreground mt-[0.1875rem] size-3.5 shrink-0"
      />
      <span className="min-w-0 wrap-break-word">{name}</span>
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
