import { useEffect, useState } from "react";

// Home's first showing after the app opens lets its cards arrive one by one;
// every later visit shows them at once, until the app is opened again.
let homeHasArrived = false;

// A Home with no wallets has no cards yet, so it leaves the arrival for the
// first showing that does.
export function useFirstShowing(hasCards: boolean) {
  const [first] = useState(() => !homeHasArrived);
  useEffect(() => {
    if (hasCards) {
      homeHasArrived = true;
    }
  }, [hasCards]);
  return first;
}

interface ArrivalProps {
  /** Its place in the sequence; each card follows the last by 40ms. */
  order: number;
  animate: boolean;
  children: React.ReactNode;
}

/** Wraps a card so it arrives in turn; the wrapper passes a stretched height on to the card. */
export function Arrival({ order, animate, children }: Readonly<ArrivalProps>) {
  if (!animate) {
    return children;
  }
  return (
    <div
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-backwards motion-safe:ease-out-expo *:h-full motion-safe:duration-300"
      style={{ animationDelay: `${order * 40}ms` }}
    >
      {children}
    </div>
  );
}
