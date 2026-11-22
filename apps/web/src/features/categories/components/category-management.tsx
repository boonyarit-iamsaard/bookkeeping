"use client";

import { Dialog } from "@base-ui/react/dialog";
import type {
  CategoryKind,
  CategorySummary,
} from "@bookkeeping/domain/categories";
import { LockKeyhole, Plus } from "lucide-react";
import { useState } from "react";
import { TitleBar } from "@/core/shell/title-bar";
import type { CategoryColor } from "@/features/categories/category-color";
import { createCategoryColors } from "@/features/categories/category-color";
import { CATEGORY_KIND_LABELS } from "@/features/categories/category-labels";
import { searchCategories } from "@/features/categories/category-search";
import {
  CategoryIcon,
  CategoryTile,
  ChildMarker,
} from "@/features/categories/components/category-icon";
import { CategoryTable } from "@/features/categories/components/category-table";
import { CreateCategoryForm } from "@/features/categories/components/create-category-form";
import type { RemovalContext } from "@/features/categories/components/edit-category-form";
import { entriesLabel } from "@/features/categories/components/edit-category-form";
import type { EditResult } from "@/features/categories/components/edit-category-sheet";
import { EditCategorySheet } from "@/features/categories/components/edit-category-sheet";
import { DashboardCard } from "@/shared/components/dashboard-card";
import { DashboardRow } from "@/shared/components/dashboard-row";
import { listCardClass } from "@/shared/components/list-section";
import { SavedNotice } from "@/shared/components/saved-notice";
import { Button } from "@/shared/components/ui/button";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { SheetHeader, SheetPortal } from "@/shared/components/ui/sheet";
import { cn } from "@/shared/helpers/cn";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

interface CategoryManagementProps {
  categories: readonly CategorySummary[];
  /** Current entry counts by category id; absent means none. */
  usage: Readonly<Record<string, number>>;
}

// Expense first: it is the tree that gets customized.
const KIND_OPTIONS = (
  ["expense", "income"] as const satisfies readonly CategoryKind[]
).map((value) => ({ value, label: CATEGORY_KIND_LABELS[value] }));

interface KindSwitchProps {
  kind: CategoryKind;
  onChange: (kind: CategoryKind) => void;
}

/** Expense or Income: the phone's tree switch, and the desktop sheet's choice of tree. */
function KindSwitch({ kind, onChange }: Readonly<KindSwitchProps>) {
  return (
    <div>
      <span id="category-tree-label" className="sr-only">
        Category tree
      </span>
      <SegmentedControl
        aria-labelledby="category-tree-label"
        options={KIND_OPTIONS}
        value={kind}
        onValueChange={onChange}
      />
    </div>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * One row, and the sheet it opens; focus comes back here on close. A child
 * sits one step in: its › under the parent's tile, its smaller tile in line
 * with the parent's name. Names wrap rather than truncate.
 */
function CategoryRow({
  category,
  color,
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
          "group/row hover:bg-accent/70 focus-visible:ring-ring/45 active:bg-accent flex w-full items-center gap-3.5 px-4 text-left transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-inset motion-reduce:transition-none",
          isChild ? "min-h-14 py-2.5" : "min-h-16 py-3",
        )}
      >
        {isChild && <ChildMarker />}
        <CategoryTile color={color} size={isChild ? "child" : "row"}>
          <CategoryIcon iconId={category.iconId} />
        </CategoryTile>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn(
              "leading-snug wrap-break-word",
              isChild ? "font-medium" : "font-semibold",
            )}
          >
            {category.name}
          </span>
          {(category.isProtected || entries > 0) && (
            <span className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-sm">
              {category.isProtected && (
                <span className="inline-flex items-center gap-1">
                  <LockKeyhole
                    aria-hidden="true"
                    strokeWidth={2}
                    className="size-3.5"
                  />
                  Protected
                </span>
              )}
              {category.isProtected && entries > 0 && (
                <span aria-hidden="true">·</span>
              )}
              {entries > 0 && <span>{entriesLabel(entries)}</span>}
            </span>
          )}
        </span>
      </Dialog.Trigger>
      <EditCategorySheet
        category={category}
        color={color}
        removal={removal}
        onDone={(result) => {
          setOpen(false);
          onDone(result);
        }}
        onCancel={() => setOpen(false)}
      />
    </Dialog.Root>
  );
}

/**
 * Both trees behind one segmented switch, each parent and its children on
 * one list card, every row a button to its edit sheet. The list is server
 * truth; every change re-reads it and says what happened in the notice
 * beneath the title.
 */
export function CategoryManagement({
  categories,
  usage,
}: Readonly<CategoryManagementProps>) {
  const desktop = useIsDesktop();
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState({ message: "", takesFocus: false });
  const { groups } = searchCategories({ categories, kind, query: "" });
  const colorOf = createCategoryColors(categories);

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
              {desktop && (
                // Both trees are on show, so the sheet asks which one.
                <div className="px-4 pb-2 sm:px-6">
                  <KindSwitch kind={kind} onChange={setKind} />
                </div>
              )}
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

      {desktop ? (
        <DashboardRow className="lg:grid-cols-2">
          {KIND_OPTIONS.map((option) => (
            <DashboardCard
              key={option.value}
              headingId={`${option.value}-categories-heading`}
              heading={option.label}
            >
              <CategoryTable
                label={`${option.label} categories`}
                groups={
                  searchCategories({
                    categories,
                    kind: option.value,
                    query: "",
                  }).groups
                }
                colorOf={colorOf}
                usage={usage}
                onDone={finishEdit}
              />
            </DashboardCard>
          ))}
        </DashboardRow>
      ) : (
        <>
          <KindSwitch kind={kind} onChange={setKind} />

          <ul
            className="flex flex-col gap-3 sm:gap-4"
            aria-label={`${CATEGORY_KIND_LABELS[kind]} categories`}
          >
            {groups.map((group) => {
              const color = colorOf(group.parent.id);
              return (
                <li key={group.parent.id} className={listCardClass}>
                  <CategoryRow
                    category={group.parent}
                    color={color}
                    removal={{
                      parentName: null,
                      childCount: group.children.length,
                      entries: usage[group.parent.id] ?? 0,
                    }}
                    onDone={finishEdit}
                  />
                  {group.children.length > 0 && (
                    <ul
                      aria-label={`${group.parent.name} children`}
                      className="divide-border/70 divide-y"
                    >
                      {group.children.map((child) => (
                        <li key={child.id}>
                          <CategoryRow
                            category={child}
                            color={color}
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
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

interface CategoryRowProps {
  category: CategorySummary;
  /** The parent's hue; a child wears it too. */
  color: CategoryColor;
  isChild?: boolean;
  removal: RemovalContext;
  onDone: (result: Readonly<EditResult>) => void;
}
