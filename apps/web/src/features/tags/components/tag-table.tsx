import { EditTagSheet } from "@/features/tags/components/edit-tag-sheet";
import type { EditTagOutcome } from "@/features/tags/hooks/use-edit-tag-form";
import type { TagSummary } from "@/features/tags/tag-search";
import { SheetTableRow } from "@/shared/components/sheet-table-row";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

interface TagTableProps {
  tags: readonly TagSummary[];
  onDone: (tag: Readonly<TagSummary>, outcome: EditTagOutcome) => void;
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
          <SheetTableRow
            key={tag.id}
            marker={{ "data-tag-row": tag.id }}
            name={tag.name}
            nameClassName="font-semibold"
            count={tag.transactionCount}
            renderSheet={(close) => (
              <EditTagSheet
                tag={tag}
                others={tags.filter((other) => other.id !== tag.id)}
                onDone={(outcome) => {
                  close();
                  onDone(tag, outcome);
                }}
                onCancel={close}
              />
            )}
          />
        ))}
      </TableBody>
    </Table>
  );
}
