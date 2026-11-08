import { Plus } from "lucide-react";
import { useId, useRef } from "react";
import { cn } from "@/shared/helpers/cn";

// The search-and-choose list a picker sheet holds: a search field, then
// full-width option rows that arrow keys walk. The Category and Tag
// pickers both read this way.

/**
 * Arrow keys walk the options, Up from the first returns to the search
 * field, and Enter in the search field takes `onEnter` (by default the
 * first option).
 */
export function useSheetOptions() {
  const listRef = useRef<HTMLDivElement>(null);
  const searchId = useId();

  function options(): HTMLButtonElement[] {
    return Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        "[data-option]:not(:disabled)",
      ) ?? [],
    );
  }

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

  return {
    listRef,
    searchId,
    optionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
      moveFocus(event, options().indexOf(event.currentTarget));
    },
    searchKeyDown(
      event: React.KeyboardEvent<HTMLInputElement>,
      onEnter: () => void = () => options()[0]?.click(),
    ) {
      if (event.key === "Enter") {
        event.preventDefault();
        onEnter();
        return;
      }
      moveFocus(event, -1);
    },
  };
}

/** One full-width row in a picker's results; arrow keys move between them. */
export function SheetOption({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      data-option
      className={cn(
        "group/row hover:bg-accent/70 focus-visible:ring-ring/45 active:bg-accent flex w-full items-center gap-3.5 px-5 text-left transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

/** The Iris Tonal tile that leads a create row, sized like a Category Tile. */
export function CreateTile() {
  return (
    <span className="bg-secondary text-secondary-foreground flex size-11 shrink-0 items-center justify-center rounded-lg">
      <Plus aria-hidden="true" strokeWidth={2} className="size-5" />
    </span>
  );
}
