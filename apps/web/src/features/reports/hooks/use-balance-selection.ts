import { useState } from "react";
import type {
  BalanceSelectionMovement,
  ResolveBalanceSelectionOptions,
} from "../balance-selection";
import {
  moveBalanceSelection,
  resolveBalanceSelection,
} from "../balance-selection";

/** Reconcile during render so stale figures cannot appear for even one frame. */
export function useBalanceSelection(
  options: Readonly<Omit<ResolveBalanceSelectionOptions, "previous">>,
) {
  const [memory, setMemory] = useState(
    () => resolveBalanceSelection(options).memory,
  );
  const selection = resolveBalanceSelection({ ...options, previous: memory });
  if (
    memory.month !== selection.memory.month ||
    memory.balanceDate !== selection.memory.balanceDate ||
    memory.date !== selection.memory.date
  ) {
    setMemory(selection.memory);
  }
  function move(movement: Readonly<BalanceSelectionMovement>) {
    setMemory(moveBalanceSelection(selection, movement));
  }
  return { ...selection, move };
}
