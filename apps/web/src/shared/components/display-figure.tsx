import type { ApiMoney } from "@/core/api/money";
import { Money } from "@/shared/components/money";

interface DisplayFigureProps {
  amount: ApiMoney;
  /** Prefixed as given, such as "−" when the figure's meaning carries it. */
  sign?: string;
  /** Names the figure; it is the card's label and the region's name. */
  heading: string;
  headingId: string;
  /** The Caption beneath, saying what the figure covers. */
  caption: React.ReactNode;
}

/**
 * The app icon's bowl and coin, large and faint off the card's corner: the
 * hero's one ornament, and the mark's motif rather than a stock flourish.
 */
function HeroCoin() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 240 240"
      fill="none"
      className="pointer-events-none absolute -top-16 -right-16 -z-10 size-60 sm:-top-20 sm:size-72"
    >
      <circle
        cx="120"
        cy="120"
        r="84"
        stroke="var(--hero-foreground)"
        strokeOpacity="0.09"
        strokeWidth="44"
      />
      <circle cx="120" cy="120" r="34" fill="#9d8cff" fillOpacity="0.32" />
    </svg>
  );
}

/**
 * A screen's one large figure on the Midnight hero card: its label, the
 * figure with the ฿ and satang stepped down, and the Caption beneath.
 */
export function DisplayFigure({
  amount,
  sign,
  heading,
  headingId,
  caption,
}: Readonly<DisplayFigureProps>) {
  return (
    <section
      aria-labelledby={headingId}
      className="relative isolate flex min-h-44 flex-col overflow-hidden rounded-3xl bg-hero px-5 pt-6 pb-6 text-hero-foreground shadow-hero sm:min-h-48 sm:px-7 sm:pt-7 sm:pb-7"
    >
      <HeroCoin />
      <h2 id={headingId} className="font-medium text-hero-muted text-sm">
        {heading}
      </h2>
      <p className="mt-auto pt-4 font-bold text-4xl leading-none tracking-[-0.025em] sm:text-5xl">
        <Money amount={amount} sign={sign} display className="font-bold" />
      </p>
      <p className="mt-3 text-hero-muted text-sm">{caption}</p>
    </section>
  );
}
