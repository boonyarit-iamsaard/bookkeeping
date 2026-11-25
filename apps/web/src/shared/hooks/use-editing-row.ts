import { useState } from "react";

/**
 * The one record a table's edit sheet is open on. `row` stays after closing so
 * the sheet keeps its content while it animates out; spread `rootProps` onto
 * the sheet's `Dialog.Root`. A sheet opened from a row menu has no trigger to
 * return focus to, so once closed, focus goes to the row's name button.
 */
export function useEditingRow<TRow>(nameButton: (row: TRow) => string) {
  const [state, setState] = useState<{ row: TRow | null; open: boolean }>({
    row: null,
    open: false,
  });
  const close = () => setState((current) => ({ ...current, open: false }));
  return {
    row: state.row,
    edit: (row: TRow) => setState({ row, open: true }),
    close,
    rootProps: {
      open: state.open,
      onOpenChange: (open: boolean) => !open && close(),
      onOpenChangeComplete: (open: boolean) => {
        const active = document.activeElement;
        if (open || !state.row || (active && active !== document.body)) {
          return;
        }
        document.querySelector<HTMLElement>(nameButton(state.row))?.focus();
      },
    },
  };
}
