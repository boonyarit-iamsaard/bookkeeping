import { Columns3 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { ColumnDefaults } from "@/shared/helpers/column-visibility";
import { readColumnVisibility } from "@/shared/helpers/column-visibility";

function readStored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** One table's column choice, kept per browser under `storageKey`. */
export function useStoredColumnVisibility(
  storageKey: string,
  columns: readonly ColumnDefaults[],
) {
  const [visibility, setVisibility] = useState(() =>
    readColumnVisibility(readStored(storageKey), columns),
  );
  function change(next: Record<string, boolean>) {
    setVisibility(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Blocked site data: the choice lasts as long as the page.
    }
  }
  return [visibility, change] as const;
}

interface MenuColumn {
  id: string;
  label: string;
  visible: boolean;
  /** False for a column that always shows. */
  hideable: boolean;
  setVisible: (visible: boolean) => void;
}

/** Shows or hides a table's optional columns; the fixed ones stay listed, checked. */
export function ColumnsMenu({
  columns,
}: Readonly<{ columns: readonly MenuColumn[] }>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Columns3 aria-hidden="true" strokeWidth={1.75} />
        Columns
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Show columns</DropdownMenuLabel>
          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.visible}
              disabled={!column.hideable}
              closeOnClick={false}
              onCheckedChange={column.setVisible}
            >
              {column.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
