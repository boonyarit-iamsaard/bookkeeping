import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/helpers/cn";

export interface SummaryStripCard {
  /** Names the card's dot. */
  name: string;
  content: React.ReactNode;
}

interface SummaryStripProps {
  cards: readonly SummaryStripCard[];
}

/** A card counts as shown once most of it sits in the strip. */
const SHOWN_THRESHOLD = 0.6;

/**
 * The summary cards as one native scroll-snap row, the first card showing, one
 * dot per card beneath. The strip scrolls on the x axis only, so the page keeps
 * its own scrolling. Every card fills the row, so a swipe moves only the cards.
 */
export function SummaryStrip({ cards }: Readonly<SummaryStripProps>) {
  const strip = useRef<HTMLDivElement>(null);
  const slots = useRef<(Element | null)[]>([]);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const root = strip.current;
    if (!root) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(slots.current.indexOf(entry.target));
          }
        }
      },
      { root, threshold: SHOWN_THRESHOLD },
    );
    for (const slot of slots.current) {
      if (slot) {
        observer.observe(slot);
      }
    }
    return () => observer.disconnect();
  }, []);

  function show(index: number) {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    slots.current[index]?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "nearest",
      inline: "start",
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Padding and the matching negative margin leave the cards' shadows unclipped. */}
      <section
        ref={strip}
        aria-label="Summary"
        className="-mx-2 -my-2 flex snap-x snap-mandatory [scroll-padding-inline:0.5rem] [scrollbar-width:none] gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain px-2 py-2 [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card, index) => (
          <div
            key={card.name}
            ref={(element) => {
              slots.current[index] = element;
            }}
            className="w-full min-w-full shrink-0 snap-start"
          >
            {card.content}
          </div>
        ))}
      </section>
      {/* The 8px row sets the rhythm; its 44px buttons overflow it evenly. */}
      <div className="relative -mb-2 flex h-2 items-center justify-center sm:-mb-4">
        {cards.map((card, index) => (
          <button
            key={card.name}
            type="button"
            aria-current={index === shown ? "true" : undefined}
            onClick={() => show(index)}
            className="group flex size-11 shrink-0 items-center justify-center outline-none first:justify-end first:pr-1 last:justify-start last:pl-1"
          >
            <span className="sr-only">{card.name}</span>
            <span
              aria-hidden="true"
              className={cn(
                "ease-out-expo group-focus-visible:ring-ring/45 size-2 rounded-full transition-[background-color,scale] duration-150 group-focus-visible:ring-[3px] motion-reduce:transition-none",
                index === shown
                  ? "bg-primary"
                  : "bg-muted-foreground/35 group-hover:bg-muted-foreground/60",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
