import { Link } from "@tanstack/react-router";
import { TAG_CHIP_TEXT, TagChip } from "@/features/tags/components/tag-chip";
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
  /** On a wallet's page, the wallet a chip's filter keeps. */
  pageWalletId?: string;
}

/** Above the row's stretched link, so a chip is its own target. */
const CHIP_TARGET =
  "relative z-1 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45";

/**
 * A table row's tags on one line: one chip, filtering the history by its
 * tag, then a "+N" chip that names every tag on hover, focus and to
 * assistive technology.
 */
export function TransactionTagsCell({
  tags,
  pageWalletId,
}: Readonly<TransactionTagsCellProps>) {
  if (tags.length === 0) {
    return null;
  }
  const { shown, hidden } = splitTagOverflow(tags);
  const names = tags.map((tag) => tag.name).join(", ");
  return (
    // A reserved width, so a narrow table never squeezes the chips onto
    // Amount; they overhang the text line rather than heighten the row.
    <ul aria-label="Tags" className="-my-0.5 flex w-36 gap-1.5">
      {shown.map((tag) => (
        <li key={tag.id} className="flex min-w-0">
          <Link
            to="/transactions"
            search={(previous) => ({
              ...changeHistoryTable(previous, {}),
              ...(pageWalletId && { walletId: pageWalletId }),
              tagId: [tag.id],
            })}
            title={tag.name}
            aria-label={`Show transactions tagged ${tag.name}`}
            className={cn(
              CHIP_TARGET,
              "hover:[&>span]:bg-accent flex min-w-0 overflow-hidden",
            )}
          >
            <TagChip
              name={tag.name}
              truncate
              size="table"
              className="min-w-0"
            />
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
                "bg-muted text-foreground px-2.5 py-0.5 font-medium tabular-nums",
                TAG_CHIP_TEXT.table,
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
