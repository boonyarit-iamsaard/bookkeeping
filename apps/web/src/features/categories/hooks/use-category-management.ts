import { useState } from "react";
import { entriesLabel } from "@/features/categories/components/edit-category-form-sections";
import type { EditResult } from "@/features/categories/components/edit-category-sheet";

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function useCategoryManagement() {
  const [notice, setNotice] = useState({ message: "", takesFocus: false });

  function announce(message: string) {
    setNotice({ message, takesFocus: false });
  }

  function finishEdit({ category, removal, outcome }: Readonly<EditResult>) {
    if (outcome.operation === "update") {
      announce(
        outcome.category.name === category.name
          ? `${category.name} has a new icon.`
          : `${category.name} is now ${outcome.category.name}.`,
      );
      return;
    }
    const destination = removal.parentName ?? "Uncategorized";
    setNotice({
      message:
        outcome.reassigned === 0
          ? `${category.name} removed.`
          : `${category.name} removed. ${capitalize(entriesLabel(outcome.reassigned))} moved to ${destination}.`,
      // The row that had focus is gone; the announcement takes it.
      takesFocus: true,
    });
  }

  return { notice, announce, finishEdit };
}
