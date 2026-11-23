import type { CategorySummary } from "@bookkeeping/domain/categories";
import type { CategoryColor } from "@/features/categories/category-color";
import type { CategoryGroup } from "@/features/categories/category-search";
import type { EditResult } from "@/features/categories/components/edit-category-sheet";
import { EditCategorySheet } from "@/features/categories/components/edit-category-sheet";
import { SheetTableRow } from "@/shared/components/sheet-table-row";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

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

/** One row, and the edit sheet it opens; a child sits one step in under its parent. */
function CategoryTableRow({
  category,
  color,
  parentName,
  childCount,
  entries,
  onDone,
}: Readonly<CategoryTableRowProps>) {
  return (
    <SheetTableRow
      marker={{ "data-category-row": category.id }}
      name={category.name}
      nameClassName={parentName === null ? "font-semibold" : "pl-8!"}
      count={entries}
      renderSheet={(close) => (
        <EditCategorySheet
          category={category}
          color={color}
          removal={{ parentName, childCount, entries }}
          onDone={(result) => {
            close();
            onDone(result);
          }}
          onCancel={close}
        />
      )}
    />
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
