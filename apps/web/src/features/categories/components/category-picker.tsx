"use client";

import { Dialog } from "@base-ui/react/dialog";
import type {
  CategoryKind,
  CategorySummary,
} from "@bookkeeping/domain/categories";
import { ArrowLeft, Check, ChevronDown, Plus, Search } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { CategoryColor } from "@/features/categories/category-color";
import { createCategoryColors } from "@/features/categories/category-color";
import { CATEGORY_KIND_LABELS } from "@/features/categories/category-labels";
import type { CreateCategoryOutcome } from "@/features/categories/category-mutations";
import type { CategoryGroup } from "@/features/categories/category-search";
import {
  categoryPath,
  searchCategories,
} from "@/features/categories/category-search";
import {
  CategoryIcon,
  CategoryTile,
  ChildMarker,
} from "@/features/categories/components/category-icon";
import { CreateCategoryForm } from "@/features/categories/components/create-category-form";
import { Button } from "@/shared/components/ui/button";
import { fieldControlClass, Input } from "@/shared/components/ui/input";
import { SheetHeader, SheetPortal } from "@/shared/components/ui/sheet";
import { cn } from "@/shared/helpers/cn";

interface CategoryPickerProps {
  id: string;
  kind: CategoryKind;
  categories: readonly CategorySummary[];
  value: string;
  onSelect: (categoryId: string) => void;
  /** The saved category (and any parent saved with it); it is selected too. */
  onCreated: (outcome: CreateCategoryOutcome) => void;
  "aria-labelledby": string;
  "aria-describedby"?: string;
  invalid?: boolean;
  disabled?: boolean;
}

type View =
  | { name: "search" }
  | { name: "create"; initialName: string; initialParentId?: string };

/**
 * The Category row: a trigger that reads the current choice back, and one
 * panel with two views. Search over both levels of the active tree, or
 * create a parent or child (with a missing parent) without leaving the
 * transaction. A sheet on phone, a dialog on desktop; either way the
 * transaction form behind it keeps every value.
 */
export function CategoryPicker({
  id,
  kind,
  categories,
  value,
  onSelect,
  onCreated,
  invalid,
  disabled,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
}: Readonly<CategoryPickerProps>) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ name: "search" });
  const [query, setQuery] = useState("");
  const valueId = `${id}-value`;
  const selected = categories.find((category) => category.id === value);
  const colorOf = createCategoryColors(categories);

  function openPanel(next: boolean) {
    if (next) {
      setView({ name: "search" });
      setQuery("");
    }
    setOpen(next);
  }

  function choose(categoryId: string) {
    onSelect(categoryId);
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={openPanel}>
      <Dialog.Trigger
        id={id}
        disabled={disabled}
        aria-labelledby={`${labelledBy} ${valueId}`}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        className={cn(
          fieldControlClass,
          "flex h-auto min-h-11 items-center gap-3 py-1.5 pr-3.5 pl-1.5 text-left disabled:cursor-not-allowed sm:h-auto sm:min-h-10",
        )}
      >
        <CategoryTile
          color={selected ? colorOf(selected.id) : "neutral"}
          className="size-8 rounded-md [&_svg]:size-4"
        >
          <CategoryIcon iconId={selected?.iconId ?? "generic"} />
        </CategoryTile>
        <span id={valueId} className="wrap-break-word min-w-0 flex-1">
          {selected ? categoryPath(selected, categories) : "Choose a category"}
        </span>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-4 shrink-0 text-muted-foreground"
        />
      </Dialog.Trigger>

      <SheetPortal>
        {view.name === "search" ? (
          <SearchView
            kind={kind}
            colorOf={colorOf}
            categories={categories}
            value={value}
            query={query}
            onQueryChange={setQuery}
            onSelect={choose}
            onCreate={(initialName, initialParentId) =>
              setView({ name: "create", initialName, initialParentId })
            }
          />
        ) : (
          <>
            <SheetHeader
              leadingAction={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-touch"
                  aria-label="Back to search"
                  onClick={() => setView({ name: "search" })}
                >
                  <ArrowLeft strokeWidth={1.75} className="size-5" />
                </Button>
              }
            >
              New {CATEGORY_KIND_LABELS[kind].toLowerCase()} category
            </SheetHeader>
            <CreateCategoryForm
              kind={kind}
              categories={categories}
              initialName={view.initialName}
              initialParentId={view.initialParentId}
              onCreated={(outcome) => {
                onCreated(outcome);
                setOpen(false);
              }}
              onCancel={() => setView({ name: "search" })}
            />
          </>
        )}
      </SheetPortal>
    </Dialog.Root>
  );
}

interface SearchViewProps {
  kind: CategoryKind;
  colorOf: (categoryId: string) => CategoryColor;
  categories: readonly CategorySummary[];
  value: string;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (categoryId: string) => void;
  onCreate: (initialName: string, initialParentId?: string) => void;
}

function SearchView({
  kind,
  colorOf,
  categories,
  value,
  query,
  onQueryChange,
  onSelect,
  onCreate,
}: Readonly<SearchViewProps>) {
  const listRef = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const trimmed = query.trim();
  const { groups, exactMatch } = searchCategories({ categories, kind, query });
  const offerCreate = trimmed.length > 0 && !exactMatch;
  const nothingMatched = groups.length === 0;

  function options(): HTMLButtonElement[] {
    return Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("[data-option]") ??
        [],
    );
  }

  /** Arrow keys walk the results; Enter in the search box takes the first. */
  function moveFocus(event: React.KeyboardEvent, from: number) {
    const items = options();
    if (items.length === 0) {
      return;
    }
    let next: number | undefined;
    if (event.key === "ArrowDown") {
      next = Math.min(from + 1, items.length - 1);
    } else if (event.key === "ArrowUp") {
      next = from <= 0 ? -1 : from - 1;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = items.length - 1;
    }
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    if (next < 0) {
      document.getElementById(searchId)?.focus();
    } else {
      items[next]?.focus();
    }
  }

  function optionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    moveFocus(event, options().indexOf(event.currentTarget));
  }

  // A query that fell inside exactly one parent's children most likely
  // wants to join them; anything more ambiguous leaves the parent unset.
  const impliedParent =
    groups.length === 1 && !groups[0]?.parentMatches
      ? groups[0]?.parent.id
      : undefined;

  const createRow = offerCreate && (
    <OptionRow
      onKeyDown={optionKeyDown}
      onClick={() => onCreate(trimmed, impliedParent)}
      className="min-h-15 py-2.5"
    >
      <CreateTile />
      <span className="min-w-0 flex-1">
        <span className="wrap-break-word block font-semibold">
          Create “{trimmed}”
        </span>
        <span className="block text-muted-foreground text-sm">
          New {CATEGORY_KIND_LABELS[kind].toLowerCase()} category
        </span>
      </span>
    </OptionRow>
  );

  return (
    <>
      <SheetHeader>{CATEGORY_KIND_LABELS[kind]} category</SheetHeader>
      <div className="shrink-0 px-5 pb-3 sm:px-6">
        <div className="relative">
          <Search
            aria-hidden="true"
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={searchId}
            type="search"
            autoComplete="off"
            enterKeyHint="go"
            placeholder="Search or create…"
            aria-label="Search categories"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                options()[0]?.click();
                return;
              }
              moveFocus(event, -1);
            }}
            className="pl-11 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
      </div>
      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-border/70 border-t pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {nothingMatched && createRow}
        {nothingMatched && !offerCreate && (
          <p className="px-5 py-6 text-muted-foreground text-sm sm:px-6">
            No categories yet.
          </p>
        )}
        {groups.length > 0 && (
          <ul aria-label="Categories" className="divide-y divide-border/70">
            {groups.map((group) => (
              <CategoryGroupRows
                key={group.parent.id}
                group={group}
                color={colorOf(group.parent.id)}
                value={value}
                onSelect={onSelect}
                onOptionKeyDown={optionKeyDown}
              />
            ))}
          </ul>
        )}
        {!nothingMatched && createRow}
        {!offerCreate && (
          <OptionRow
            onKeyDown={optionKeyDown}
            onClick={() => onCreate("")}
            className="min-h-15 py-2.5"
          >
            <CreateTile />
            <span className="font-semibold">New category</span>
          </OptionRow>
        )}
      </div>
    </>
  );
}

interface CategoryGroupRowsProps {
  group: CategoryGroup;
  color: CategoryColor;
  value: string;
  onSelect: (categoryId: string) => void;
  onOptionKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

/** A parent row, then its children indented beneath; both are choices. */
function CategoryGroupRows({
  group,
  color,
  value,
  onSelect,
  onOptionKeyDown,
}: Readonly<CategoryGroupRowsProps>) {
  return (
    <li>
      <CategoryRow
        category={group.parent}
        color={color}
        selected={group.parent.id === value}
        onSelect={onSelect}
        onKeyDown={onOptionKeyDown}
      />
      {group.children.length > 0 && (
        <ul aria-label={`${group.parent.name} children`}>
          {group.children.map((child) => (
            <li key={child.id}>
              <CategoryRow
                category={child}
                color={color}
                isChild
                selected={child.id === value}
                onSelect={onSelect}
                onKeyDown={onOptionKeyDown}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface CategoryRowProps {
  category: CategorySummary;
  color: CategoryColor;
  isChild?: boolean;
  selected: boolean;
  onSelect: (categoryId: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

function CategoryRow({
  category,
  color,
  isChild,
  selected,
  onSelect,
  onKeyDown,
}: Readonly<CategoryRowProps>) {
  return (
    <OptionRow
      data-category-option={category.id}
      aria-current={selected || undefined}
      onClick={() => onSelect(category.id)}
      onKeyDown={onKeyDown}
      className={cn(
        "aria-current:bg-secondary/60",
        isChild ? "min-h-13 py-2" : "min-h-15 py-2.5",
      )}
    >
      {isChild && <ChildMarker />}
      <CategoryTile color={color} size={isChild ? "child" : "row"}>
        <CategoryIcon iconId={category.iconId} />
      </CategoryTile>
      <span
        className={cn(
          "wrap-break-word min-w-0 flex-1 leading-snug",
          isChild ? "font-medium" : "font-semibold",
        )}
      >
        {category.name}
      </span>
      {selected && (
        <Check
          aria-hidden="true"
          strokeWidth={2}
          className="size-5 shrink-0 text-link"
        />
      )}
    </OptionRow>
  );
}

/** One full-width row in the results; arrow keys move between them. */
function OptionRow({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      data-option
      className={cn(
        "flex w-full items-center gap-3.5 px-5 text-left outline-none transition-colors duration-150 hover:bg-accent/70 focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:ring-inset motion-reduce:transition-none sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

/** The Iris Tonal tile that leads a create row, sized like a Category Tile. */
function CreateTile() {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
      <Plus aria-hidden="true" strokeWidth={2} className="size-5" />
    </span>
  );
}
