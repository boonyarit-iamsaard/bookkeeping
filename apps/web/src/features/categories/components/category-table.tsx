import { Dialog } from "@base-ui/react/dialog";
import type { CategorySummary } from "@bookkeeping/domain/categories";
import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { CategoryColor } from "@/features/categories/category-color";
import type { CategoryGroup } from "@/features/categories/category-search";
import {
  CategoryIcon,
  CategoryTile,
} from "@/features/categories/components/category-icon";
import type { EditResult } from "@/features/categories/components/edit-category-sheet";
import { EditCategorySheet } from "@/features/categories/components/edit-category-sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { cn } from "@/shared/helpers/cn";

interface CategoryTableProps {
  /** Names the table, e.g. "Expense categories". */
  label: string;
  groups: readonly CategoryGroup[];
  colorOf: (parentId: string) => CategoryColor;
  /** Current entry counts by category id; absent means none. */
  usage: Readonly<Record<string, number>>;
  onDone: (result: Readonly<EditResult>) => void;
}

interface CategoryTableRowProps {
  category: CategorySummary;
  color: CategoryColor;
  parentName: string | null;
  childCount: number;
  entries: number;
  onDone: (result: Readonly<EditResult>) => void;
}

/** One row, and the sheet it opens; its name is the button, stretched over the row. */
function CategoryTableRow({
  category,
  color,
  parentName,
  childCount,
  entries,
  onDone,
}: Readonly<CategoryTableRowProps>) {
  const [open, setOpen] = useState(false);
  const isChild = parentName !== null;
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <TableRow className="has-[button:hover]:bg-accent/70">
        <TableCell className={cn(isChild && "pl-8!")}>
          <Dialog.Trigger
            data-category-row={category.id}
            className="group/row focus-visible:after:ring-ring/45 flex items-center gap-3 text-left outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-inset"
          >
            <CategoryTile color={color} size="child">
              <CategoryIcon iconId={category.iconId} />
            </CategoryTile>
            <span className={cn(!isChild && "font-semibold")}>
              {category.name}
            </span>
            {category.isProtected && (
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <LockKeyhole
                  aria-hidden="true"
                  strokeWidth={2}
                  className="size-3.5"
                />
                Protected
              </span>
            )}
          </Dialog.Trigger>
        </TableCell>
        <TableCell className="text-muted-foreground text-right tabular-nums">
          {entries}
        </TableCell>
      </TableRow>
      <EditCategorySheet
        category={category}
        color={color}
        removal={{ parentName, childCount, entries }}
        onDone={(result) => {
          setOpen(false);
          onDone(result);
        }}
        onCancel={() => setOpen(false)}
      />
    </Dialog.Root>
  );
}

/** One tree as a table: Name and Entries, each child one step in under its parent. */
export function CategoryTable({
  label,
  groups,
  colorOf,
  usage,
  onDone,
}: Readonly<CategoryTableProps>) {
  return (
    <Table aria-label={label}>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Entries</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map(({ parent, children }) => {
          const color = colorOf(parent.id);
          return [
            <CategoryTableRow
              key={parent.id}
              category={parent}
              color={color}
              parentName={null}
              childCount={children.length}
              entries={usage[parent.id] ?? 0}
              onDone={onDone}
            />,
            ...children.map((child) => (
              <CategoryTableRow
                key={child.id}
                category={child}
                color={color}
                parentName={parent.name}
                childCount={0}
                entries={usage[child.id] ?? 0}
                onDone={onDone}
              />
            )),
          ];
        })}
      </TableBody>
    </Table>
  );
}
