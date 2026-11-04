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
 * its own scrolling.
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
    <div className="flex flex-col gap-1">
      {/* Padding and the matching negative margin leave the cards' shadows unclipped. */}
      <section
        ref={strip}
        aria-label="Summary"
        className="-mx-2 -my-2 flex snap-x snap-mandatory [scroll-padding-inline:0.5rem] [scrollbar-width:none] overflow-x-auto overflow-y-hidden overscroll-x-contain px-2 py-2 [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-full shrink-0 gap-4">
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
        </div>
      </section>
      <div className="flex justify-center">
        {cards.map((card, index) => (
          <button
            key={card.name}
            type="button"
            aria-current={index === shown ? "true" : undefined}
            onClick={() => show(index)}
            className="group focus-visible:ring-ring/45 flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-[3px]"
          >
            <span className="sr-only">{card.name}</span>
            <span
              aria-hidden="true"
              className={cn(
                "ease-out-expo size-2 rounded-full transition-[background-color,scale] duration-150 motion-reduce:transition-none",
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
