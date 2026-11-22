import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import { EditTagSheet } from "@/features/tags/components/edit-tag-sheet";
import type { EditTagOutcome } from "@/features/tags/hooks/use-edit-tag-form";
import type { TagSummary } from "@/features/tags/tag-search";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

interface TagTableProps {
  tags: readonly TagSummary[];
  onDone: (tag: Readonly<TagSummary>, outcome: EditTagOutcome) => void;
}

interface TagTableRowProps {
  tag: TagSummary;
  others: readonly TagSummary[];
  onDone: (outcome: EditTagOutcome) => void;
}

/** One row, and the sheet it opens; its name is the button, stretched over the row. */
function TagTableRow({ tag, others, onDone }: Readonly<TagTableRowProps>) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <TableRow className="has-[button:hover]:bg-accent/70">
        <TableCell className="font-semibold">
          <Dialog.Trigger
            data-tag-row={tag.id}
            className="focus-visible:after:ring-ring/45 text-left outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-inset"
          >
            {tag.name}
          </Dialog.Trigger>
        </TableCell>
        <TableCell className="text-muted-foreground text-right tabular-nums">
          {tag.transactionCount}
        </TableCell>
      </TableRow>
      <EditTagSheet
        tag={tag}
        others={others}
        onDone={(outcome) => {
          setOpen(false);
          onDone(outcome);
        }}
        onCancel={() => setOpen(false)}
      />
    </Dialog.Root>
  );
}

/** Tags by name with how many transactions carry each; a row opens its edit sheet. */
export function TagTable({ tags, onDone }: Readonly<TagTableProps>) {
  return (
    <Table aria-label="Tags">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Transactions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tags.map((tag) => (
          <TagTableRow
            key={tag.id}
            tag={tag}
            others={tags.filter((other) => other.id !== tag.id)}
            onDone={(outcome) => onDone(tag, outcome)}
          />
        ))}
      </TableBody>
    </Table>
  );
}
