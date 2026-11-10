"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  MAX_TAG_NAME_LENGTH,
  MAX_TAGS_PER_TRANSACTION,
  normalizeTagName,
} from "@bookkeeping/domain/tags";
import { Check, ChevronDown, Hash, Search } from "lucide-react";
import { useState } from "react";
import { TagChip } from "@/features/tags/components/tag-chip";
import { useCreateTag } from "@/features/tags/hooks/use-create-tag";
import { useTagCatalog } from "@/features/tags/hooks/use-tag-catalog";
import type { TagSummary } from "@/features/tags/tag-search";
import { searchTags, tagUsageLabel } from "@/features/tags/tag-search";
import { ErrorNotice } from "@/shared/components/error-notice";
import {
  CreateTile,
  SheetOption,
  useSheetOptions,
} from "@/shared/components/sheet-options";
import { Button } from "@/shared/components/ui/button";
import { fieldControlClass, Input } from "@/shared/components/ui/input";
import { SheetHeader, SheetPortal } from "@/shared/components/ui/sheet";
import { cn } from "@/shared/helpers/cn";

/** How many suggestions sit on the form itself, one tap from chosen. */
const QUICK_TAG_COUNT = 4;

interface TagPickerProps {
  id: string;
  value: readonly string[];
  onChange: (tagIds: string[]) => void;
  "aria-labelledby": string;
  "aria-describedby"?: string;
  invalid?: boolean;
  disabled?: boolean;
}

/** The chosen set with one tag added or taken away, never past the limit. */
function toggled(value: readonly string[], tagId: string): string[] {
  if (value.includes(tagId)) {
    return value.filter((id) => id !== tagId);
  }
  return value.length < MAX_TAGS_PER_TRANSACTION
    ? [...value, tagId]
    : [...value];
}

/**
 * The Tags row: a field that reads the chosen tags back, the most recent
 * tags as one-tap chips beneath it, and a sheet to search, choose several,
 * or create one from the typed text. Choosing a tag fills in nothing else.
 */
export function TagPicker({
  id,
  value,
  onChange,
  invalid,
  disabled,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
}: Readonly<TagPickerProps>) {
  const tags = useTagCatalog();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const valueId = `${id}-value`;
  const chosen = value.flatMap((tagId) => {
    const tag = tags.find((candidate) => candidate.id === tagId);
    return tag ? [tag] : [];
  });
  const quick = tags.slice(0, QUICK_TAG_COUNT);
  const full = value.length >= MAX_TAGS_PER_TRANSACTION;

  function openSheet(next: boolean) {
    if (next) {
      setQuery("");
    }
    setOpen(next);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Dialog.Root open={open} onOpenChange={openSheet}>
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
          <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
            <Hash aria-hidden="true" strokeWidth={2} className="size-4" />
          </span>
          <span id={valueId} className="min-w-0 flex-1">
            {chosen.length === 0 ? (
              <span className="text-muted-foreground">Add tags</span>
            ) : (
              <span className="flex flex-wrap gap-1.5 py-0.5">
                <span className="sr-only">
                  {chosen.length === 1 ? "1 tag:" : `${chosen.length} tags:`}
                </span>
                {chosen.map((tag) => (
                  <TagChip
                    key={tag.id}
                    name={tag.name}
                    className="bg-secondary text-secondary-foreground pl-2.5 [&_svg]:hidden"
                  />
                ))}
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden="true"
            strokeWidth={1.75}
            className="text-muted-foreground size-4 shrink-0"
          />
        </Dialog.Trigger>

        <SheetPortal>
          <TagSheet
            tags={tags}
            value={value}
            query={query}
            onQueryChange={setQuery}
            onChange={onChange}
            onDone={() => setOpen(false)}
          />
        </SheetPortal>
      </Dialog.Root>

      {quick.length > 0 && (
        <ul aria-label="Recent tags" className="flex flex-wrap gap-2">
          {quick.map((tag) => {
            const selected = value.includes(tag.id);
            return (
              <li key={tag.id} className="flex max-w-full">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  aria-pressed={selected}
                  disabled={disabled || (full && !selected)}
                  onClick={() => onChange(toggled(value, tag.id))}
                  className={cn(
                    "h-auto min-h-11 max-w-full px-3.5 py-2 wrap-break-word whitespace-normal",
                    selected &&
                      "bg-secondary text-secondary-foreground hover:bg-secondary border-transparent",
                  )}
                >
                  {selected ? (
                    <Check aria-hidden="true" strokeWidth={2.25} />
                  ) : (
                    <Hash
                      aria-hidden="true"
                      strokeWidth={2}
                      className="text-muted-foreground"
                    />
                  )}
                  {tag.name}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface TagSheetProps {
  tags: readonly TagSummary[];
  value: readonly string[];
  query: string;
  onQueryChange: (query: string) => void;
  onChange: (tagIds: string[]) => void;
  onDone: () => void;
}

/** Search, toggle several, or create; every change applies at once. */
function TagSheet({
  tags,
  value,
  query,
  onQueryChange,
  onChange,
  onDone,
}: Readonly<TagSheetProps>) {
  const { listRef, searchId, optionKeyDown, searchKeyDown } = useSheetOptions();
  const { create, error, clearError, isPending } = useCreateTag({
    onCreated(created) {
      onChange(toggled(value, created.id));
      onQueryChange("");
      document.getElementById(searchId)?.focus();
    },
  });
  const typed = normalizeTagName(query);
  const { matches, exactMatch } = searchTags(tags, query);
  const full = value.length >= MAX_TAGS_PER_TRANSACTION;
  const offerCreate = typed.length > 0 && !exactMatch;
  const tooLong = typed.length > MAX_TAG_NAME_LENGTH;

  async function createTyped() {
    if (!offerCreate || full || tooLong || isPending) {
      return;
    }
    await create(typed);
  }

  function toggle(tagId: string) {
    onChange(toggled(value, tagId));
  }

  let createCaption = "New tag";
  if (tooLong) {
    createCaption = `Names can be at most ${MAX_TAG_NAME_LENGTH} characters`;
  } else if (isPending) {
    createCaption = "Creating…";
  }

  const createRow = offerCreate && (
    <SheetOption
      onKeyDown={optionKeyDown}
      onClick={() => void createTyped()}
      disabled={full || tooLong || isPending}
      className="min-h-15 py-2.5"
    >
      <CreateTile />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold wrap-break-word">
          Create “{typed}”
        </span>
        <span className="text-muted-foreground block text-sm">
          {createCaption}
        </span>
      </span>
    </SheetOption>
  );

  return (
    <>
      <SheetHeader subtitle={`Choose up to ${MAX_TAGS_PER_TRANSACTION}`}>
        Tags
      </SheetHeader>
      <div className="flex shrink-0 flex-col gap-3 px-5 pb-3 sm:px-6">
        <div className="relative">
          <Search
            aria-hidden="true"
            strokeWidth={1.75}
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
          />
          <Input
            id={searchId}
            type="search"
            autoComplete="off"
            enterKeyHint="go"
            placeholder="Search or create…"
            aria-label="Search tags"
            value={query}
            onChange={(event) => {
              clearError();
              onQueryChange(event.target.value);
            }}
            onKeyDown={(event) =>
              searchKeyDown(event, () => {
                if (exactMatch) {
                  toggle(exactMatch.id);
                  onQueryChange("");
                } else {
                  void createTyped();
                }
              })
            }
            className="pl-11 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        {error && <ErrorNotice>{error}</ErrorNotice>}
        {full && (
          <p role="status" className="text-muted-foreground text-sm">
            A transaction carries at most {MAX_TAGS_PER_TRANSACTION} tags.
            Remove one to add another.
          </p>
        )}
      </div>
      <div
        ref={listRef}
        className="border-border/70 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t"
      >
        {matches.length === 0 && createRow}
        {matches.length > 0 && (
          <ul aria-label="Tags" className="divide-border/70 divide-y">
            {matches.map((tag) => {
              const selected = value.includes(tag.id);
              return (
                <li key={tag.id}>
                  <SheetOption
                    data-tag-option={tag.id}
                    aria-pressed={selected}
                    disabled={full && !selected}
                    onClick={() => toggle(tag.id)}
                    onKeyDown={optionKeyDown}
                    className="aria-pressed:bg-secondary/60 min-h-15 py-2.5"
                  >
                    <span className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-lg">
                      <Hash
                        aria-hidden="true"
                        strokeWidth={2}
                        className="size-5"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold wrap-break-word">
                        {tag.name}
                      </span>
                      <span className="text-muted-foreground block text-sm">
                        {tagUsageLabel(tag.transactionCount)}
                      </span>
                    </span>
                    {selected && (
                      <Check
                        aria-hidden="true"
                        strokeWidth={2}
                        className="text-link size-5 shrink-0"
                      />
                    )}
                  </SheetOption>
                </li>
              );
            })}
          </ul>
        )}
        {matches.length > 0 && createRow}
        {matches.length === 0 && !offerCreate && (
          <p className="text-muted-foreground px-5 py-6 text-sm sm:px-6">
            No tags yet. Type a name to create the first one.
          </p>
        )}
      </div>
      <div className="border-border/70 flex shrink-0 border-t px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6 sm:pb-4">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={onDone}
          className="w-full sm:w-auto"
        >
          {value.length === 0 ? "Done" : `Done · ${value.length} chosen`}
        </Button>
      </div>
    </>
  );
}
