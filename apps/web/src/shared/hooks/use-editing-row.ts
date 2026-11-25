import { useState } from "react";

/**
 * The one record a table's edit sheet is open on. `row` stays after closing so
 * the sheet keeps its content while it animates out; spread `rootProps` onto
 * the sheet's `Dialog.Root`.
 */
export function useEditingRow<TRow>() {
  const [state, setState] = useState<{ row: TRow | null; open: boolean }>({
    row: null,
    open: false,
  });
  function close() {
    setState((current) => ({ ...current, open: false }));
  }
  return {
    row: state.row,
    edit: (row: TRow) => setState({ row, open: true }),
    close,
    rootProps: {
      open: state.open,
      onOpenChange: (open: boolean) => !open && close(),
    },
  };
}
