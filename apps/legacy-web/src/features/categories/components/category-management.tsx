"use client";

import { Dialog } from "@base-ui/react/dialog";
import type {
  CategoryKind,
  CategorySummary,
} from "@bookkeeping/domain/categories";
import { ChevronRight, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CATEGORY_KIND_LABELS } from "@/features/categories/category-labels";
import { searchCategories } from "@/features/categories/category-search";
import { CategoryDisc } from "@/features/categories/components/category-icon";
import { CreateCategoryForm } from "@/features/categories/components/create-category-form";
import type { RemovalContext } from "@/features/categories/components/edit-category-form";
import {
  EditCategoryForm,
  entriesLabel,
} from "@/features/categories/components/edit-category-form";
import type { ManageCategoryActionSuccess } from "@/features/categories/server/category.actions";
import { Button } from "@/shared/components/ui/button";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { SheetPortal } from "@/shared/components/ui/sheet";
import { cn } from "@/shared/helpers/cn";

interface CategoryManagementProps {
  categories: readonly CategorySummary[];
  /** Current entry counts by category id; absent means none. */
  usage: Readonly<Record<string, number>>;
}

// Expense first: it is the tree that gets customized.
const KIND_OPTIONS = (
  ["expense", "income"] as const satisfies readonly CategoryKind[]
).map((value) => ({ value, label: CATEGORY_KIND_LABELS[value] }));

/**
 * Both trees behind one segmented switch, each as hairline rows: parents
 * leading, children indented beneath, every row a button to its edit
 * sheet. The list is server truth; every change re-reads it and says what
 * happened in the status line beneath the title.
 */
export function CategoryManagement({
  categories,
  usage,
}: Readonly<CategoryManagementProps>) {
  const router = useRouter();
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const noticeRef = useRef<HTMLOutputElement>(null);
  const { groups } = searchCategories({ categories, kind, query: "" });

  function announce(message: string) {
    setNotice(message);
    router.refresh();
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
    announce(
      outcome.reassigned === 0
        ? `${category.name} removed.`
        : `${category.name} removed. ${capitalize(entriesLabel(outcome.reassigned))} moved to ${destination}.`,
    );
    // The row that had focus is gone; the announcement takes it.
    requestAnimationFrame(() => noticeRef.current?.focus());
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-semibold text-2xl tracking-tight">Categories</h1>
        <Dialog.Root open={creating} onOpenChange={setCreating}>
          <Dialog.Trigger
            render={<Button size="lg" className="min-h-11 sm:min-h-10" />}
          >
            <Plus data-icon="inline-start" />
            New category
          </Dialog.Trigger>
          <SheetPortal className="sm:h-auto sm:max-h-144">
            <PanelHeader>
              New {CATEGORY_KIND_LABELS[kind].toLowerCase()} category
            </PanelHeader>
            <CreateCategoryForm
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
      </div>

      <output
        ref={noticeRef}
        tabIndex={-1}
        className={cn(
          "rounded-sm text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          !notice && "sr-only",
        )}
      >
        {notice}
      </output>

      <div>
        <span id="category-tree-label" className="sr-only">
          Category tree
        </span>
        <SegmentedControl
          aria-labelledby="category-tree-label"
          options={KIND_OPTIONS}
          value={kind}
          onValueChange={setKind}
        />
      </div>

      <ul
        className="-mx-4 divide-y sm:mx-0"
        aria-label={`${CATEGORY_KIND_LABELS[kind]} categories`}
      >
        {groups.map((group) => (
          <li key={group.parent.id}>
            <CategoryRow
              category={group.parent}
              removal={{
                parentName: null,
                childCount: group.children.length,
                entries: usage[group.parent.id] ?? 0,
              }}
              onDone={finishEdit}
            />
            {group.children.length > 0 && (
              <ul aria-label={`${group.parent.name} children`}>
                {group.children.map((child) => (
                  <li key={child.id}>
                    <CategoryRow
                      category={child}
                      isChild
                      removal={{
                        parentName: group.parent.name,
                        childCount: 0,
                        entries: usage[child.id] ?? 0,
                      }}
                      onDone={finishEdit}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What a sheet finished with, and the row it belonged to. */
interface EditResult {
  category: CategorySummary;
  removal: RemovalContext;
  outcome: ManageCategoryActionSuccess;
}

interface CategoryRowProps {
  category: CategorySummary;
  isChild?: boolean;
  removal: RemovalContext;
  onDone: (result: Readonly<EditResult>) => void;
}

/** One row, and the sheet it opens; focus comes back here on close. */
function CategoryRow({
  category,
  isChild,
  removal,
  onDone,
}: Readonly<CategoryRowProps>) {
  const [open, setOpen] = useState(false);
  const entries = removal.entries;
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        data-category-row={category.id}
        className={cn(
          "flex w-full items-center gap-4 px-4 text-left outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-0 sm:hover:bg-transparent",
          isChild ? "min-h-12 border-t py-1.5 pl-8 sm:pl-10" : "min-h-14 py-2",
        )}
      >
        <CategoryDisc
          iconId={category.iconId}
          size={isChild ? "child" : "parent"}
        />
        <span className="min-w-0 flex-1 truncate">
          {isChild && (
            <span aria-hidden="true" className="mr-2 text-muted-foreground">
              ›
            </span>
          )}
          <span className={cn(!isChild && "font-medium")}>{category.name}</span>
        </span>
        {entries > 0 && (
          <span className="shrink-0 text-muted-foreground text-sm">
            {entriesLabel(entries)}
          </span>
        )}
        <ChevronRight
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-4 shrink-0 text-muted-foreground"
        />
      </Dialog.Trigger>
      <SheetPortal className="sm:h-auto sm:max-h-144">
        <PanelHeader
          subtitle={
            removal.parentName
              ? `${CATEGORY_KIND_LABELS[category.kind]} · ${removal.parentName} › ${category.name}`
              : `${CATEGORY_KIND_LABELS[category.kind]} · ${category.name}`
          }
        >
          Edit category
        </PanelHeader>
        <EditCategoryForm
          category={category}
          removal={removal}
          onDone={(outcome) => {
            setOpen(false);
            onDone({ category, removal, outcome });
          }}
          onCancel={() => setOpen(false)}
        />
      </SheetPortal>
    </Dialog.Root>
  );
}

interface PanelHeaderProps {
  children: React.ReactNode;
  subtitle?: string;
}

function PanelHeader({ children, subtitle }: Readonly<PanelHeaderProps>) {
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-2 py-2 pr-2 pl-4 sm:pl-6">
      <div className="min-w-0 flex-1">
        <Dialog.Title className="font-semibold text-lg leading-tight">
          {children}
        </Dialog.Title>
        {subtitle && (
          <Dialog.Description className="truncate text-muted-foreground text-sm">
            {subtitle}
          </Dialog.Description>
        )}
      </div>
      <Dialog.Close
        aria-label="Close"
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="size-11"
          />
        }
      >
        <X strokeWidth={1.75} className="size-5" />
      </Dialog.Close>
    </header>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
