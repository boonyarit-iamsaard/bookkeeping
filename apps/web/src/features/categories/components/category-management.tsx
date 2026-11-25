"use client";

import { Dialog } from "@base-ui/react/dialog";
import type {
  CategoryKind,
  CategorySummary,
} from "@bookkeeping/domain/categories";
import { Plus } from "lucide-react";
import { useState } from "react";
import { TitleBar } from "@/core/shell/title-bar";
import { CATEGORY_KIND_LABELS } from "@/features/categories/category-labels";
import { CreateCategoryForm } from "@/features/categories/components/create-category-form";
import { entriesLabel } from "@/features/categories/components/edit-category-form";
import type { EditResult } from "@/features/categories/components/edit-category-sheet";
import { SavedNotice } from "@/shared/components/saved-notice";
import { Button } from "@/shared/components/ui/button";
import { SheetHeader, SheetPortal } from "@/shared/components/ui/sheet";
import { cn } from "@/shared/helpers/cn";

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface CategoryManagementProps {
  categories: readonly CategorySummary[];
  /** The tree New category creates in. */
  kind: CategoryKind;
  /** Shown in the New category sheet above its form. */
  createLead?: React.ReactNode;
  /** The trees, in the composition's own layout; each edit reports to `onDone`. */
  children: (onDone: (result: Readonly<EditResult>) => void) => React.ReactNode;
}

/**
 * The title with New category, then the notice saying what the last change
 * did. The trees are server truth; every change re-reads them.
 */
export function CategoryManagement({
  categories,
  kind,
  createLead,
  children,
}: Readonly<CategoryManagementProps>) {
  const [creating, setCreating] = useState(false);
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

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <TitleBar
        title="Categories"
        actions={
          <Dialog.Root open={creating} onOpenChange={setCreating}>
            <Dialog.Trigger render={<Button variant="outline" size="lg" />}>
              <Plus data-icon="inline-start" />
              New category
            </Dialog.Trigger>
            <SheetPortal className="sm:h-auto sm:max-h-144">
              <SheetHeader>
                New {CATEGORY_KIND_LABELS[kind].toLowerCase()} category
              </SheetHeader>
              {createLead}
              <CreateCategoryForm
                key={kind}
                kind={kind}
                categories={categories}
                initialName=""
                onCreated={(outcome) => {
                  setCreating(false);
                  announce(
                    outcome.createdParent
                      ? `${outcome.createdParent.name} and ${outcome.category.name} created.`
                      : `${outcome.category.name} created.`,
                  );
                }}
                onCancel={() => setCreating(false)}
              />
            </SheetPortal>
          </Dialog.Root>
        }
      />

      <SavedNotice
        takeFocusOn={notice.takesFocus ? notice : undefined}
        className={cn(!notice.message && "sr-only")}
      >
        {notice.message}
      </SavedNotice>

      {children(finishEdit)}
    </div>
  );
}
