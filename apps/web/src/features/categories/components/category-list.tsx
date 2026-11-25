"use client";

import { Dialog } from "@base-ui/react/dialog";
import type { CategorySummary } from "@bookkeeping/domain/categories";
import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { CategoryColor } from "@/features/categories/category-color";
import type { CategoryGroup } from "@/features/categories/category-search";
import {
  CategoryIcon,
  CategoryTile,
  ChildMarker,
} from "@/features/categories/components/category-icon";
import type { RemovalContext } from "@/features/categories/components/edit-category-form";
import { entriesLabel } from "@/features/categories/components/edit-category-form";
import type { EditResult } from "@/features/categories/components/edit-category-sheet";
import { EditCategorySheet } from "@/features/categories/components/edit-category-sheet";
import { listCardClass } from "@/shared/components/list-section";
import { cn } from "@/shared/helpers/cn";

interface CategoryListProps {
  /** Names the list, e.g. "Expense categories". */
  label: string;
  groups: readonly CategoryGroup[];
  colorOf: (parentId: string) => CategoryColor;
  /** Current entry counts by category id; absent means none. */
  usage: Readonly<Record<string, number>>;
  onDone: (result: Readonly<EditResult>) => void;
}

interface CategoryRowProps {
  category: CategorySummary;
  /** The parent's hue; a child wears it too. */
  color: CategoryColor;
  isChild?: boolean;
  removal: RemovalContext;
  onDone: (result: Readonly<EditResult>) => void;
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

/** One tree: each parent and its children on one list card, every row a button to its edit sheet. */
export function CategoryList({
  label,
  groups,
  colorOf,
  usage,
  onDone,
}: Readonly<CategoryListProps>) {
  return (
    <ul className="flex flex-col gap-3 sm:gap-4" aria-label={label}>
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
              onDone={onDone}
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
                      onDone={onDone}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
