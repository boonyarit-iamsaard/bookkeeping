import { Link } from "@tanstack/react-router";
import { TagChip } from "@/features/tags/components/tag-chip";
import { splitTagOverflow } from "@/features/tags/tag-overflow";
import { changeHistoryTable } from "@/features/transactions/history-pages";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/helpers/cn";

interface TransactionTagsCellProps {
  tags: readonly { id: string; name: string }[];
}

/** Above the row's stretched link, so a chip is its own target. */
const CHIP_TARGET =
  "relative z-1 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45";

/**
 * A table row's tags on one line: two chips, each filtering the history by
 * its tag, then a "+N" chip that names every tag on hover, focus and to
 * assistive technology.
 */
export function TransactionTagsCell({
  tags,
}: Readonly<TransactionTagsCellProps>) {
  if (tags.length === 0) {
    return null;
  }
  const { shown, hidden } = splitTagOverflow(tags);
  const names = tags.map((tag) => tag.name).join(", ");
  return (
    // Chips overhang the text line rather than heighten the row.
    <ul aria-label="Tags" className="-my-0.5 flex gap-1.5">
      {shown.map((tag) => (
        <li key={tag.id} className="flex min-w-0">
          <Link
            to="/transactions"
            search={(previous) => ({
              ...changeHistoryTable(previous, {}),
              tagId: [tag.id],
            })}
            title={tag.name}
            aria-label={`Show transactions tagged ${tag.name}`}
            className={cn(
              CHIP_TARGET,
              "hover:[&>span]:bg-accent flex min-w-0 overflow-hidden",
            )}
          >
            <TagChip name={tag.name} truncate className="max-w-40 min-w-0" />
          </Link>
        </li>
      ))}
      {hidden.length > 0 && (
        <li className="flex shrink-0">
          <Tooltip>
            <TooltipTrigger
              aria-label={`${hidden.length} more ${hidden.length === 1 ? "tag" : "tags"}: ${names}`}
              className={cn(
                CHIP_TARGET,
                "bg-muted text-foreground px-2.5 py-0.5 text-[0.8125rem] leading-5 font-medium tabular-nums",
              )}
            >
              +{hidden.length}
            </TooltipTrigger>
            <TooltipContent>{names}</TooltipContent>
          </Tooltip>
        </li>
      )}
    </ul>
  );
}
