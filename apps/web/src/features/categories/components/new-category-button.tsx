"use client";

import { Dialog } from "@base-ui/react/dialog";
import type {
  CategoryKind,
  CategorySummary,
} from "@bookkeeping/domain/categories";
import { Plus } from "lucide-react";
import { useState } from "react";
import { CATEGORY_KIND_LABELS } from "@/features/categories/category-labels";
import { CreateCategoryForm } from "@/features/categories/components/create-category-form";
import { Button } from "@/shared/components/ui/button";
import { SheetHeader, SheetPortal } from "@/shared/components/ui/sheet";

interface NewCategoryButtonProps {
  categories: readonly CategorySummary[];
  kind: CategoryKind;
  createLead?: React.ReactNode;
  onCreated: (message: string) => void;
}

export function NewCategoryButton({
  categories,
  kind,
  createLead,
  onCreated,
}: Readonly<NewCategoryButtonProps>) {
  const [creating, setCreating] = useState(false);

  return (
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
            onCreated(
              outcome.createdParent
                ? `${outcome.createdParent.name} and ${outcome.category.name} created.`
                : `${outcome.category.name} created.`,
            );
          }}
          onCancel={() => setCreating(false)}
        />
      </SheetPortal>
    </Dialog.Root>
  );
}
