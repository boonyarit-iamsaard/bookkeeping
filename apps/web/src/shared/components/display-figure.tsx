import type { ApiMoney } from "@/core/api/money";
import { Money } from "@/shared/components/money";

interface DisplayFigureProps {
  amount: ApiMoney;
  /** Names the figure for assistive technology; the page shows it bare. */
  heading: string;
  headingId: string;
  /** The Caption beneath, saying what the figure covers. */
  caption: React.ReactNode;
}

/** A page's one large figure, with the Step-Down treatment and its Caption. */
export function DisplayFigure({
  amount,
  heading,
  headingId,
  caption,
}: Readonly<DisplayFigureProps>) {
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        {heading}
      </h2>
      <p className="text-4xl leading-none sm:text-5xl">
        <Money amount={amount} display />
      </p>
      <p className="mt-2 text-muted-foreground text-sm">{caption}</p>
    </section>
  );
}
