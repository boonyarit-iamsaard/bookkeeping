import { EllipsisVertical } from "lucide-react";
import type * as React from "react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

interface RowActionsMenuProps {
  /** Names the record the menu acts on, e.g. "Cash". */
  record: string;
  /** `DropdownMenuItem`s, one per action the record already has. */
  children: React.ReactNode;
}

/** A small table's row menu, for a data table's `renderRowActions` slot. */
export function RowActionsMenu({
  record,
  children,
}: Readonly<RowActionsMenuProps>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" />}
        // Above the row's stretched link, so the button is its own target.
        className="relative z-1"
        aria-label={`Actions for ${record}`}
      >
        <EllipsisVertical aria-hidden="true" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
