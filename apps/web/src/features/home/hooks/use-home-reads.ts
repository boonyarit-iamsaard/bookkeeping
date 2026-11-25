import type { CalendarDate } from "@bookkeeping/domain/dates";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useFirstShowing } from "@/features/home/components/home-arrival";
import { createHomeQueryPlan } from "@/features/home/home-queries";
import { useToday } from "@/shared/hooks/use-today";

/** The reads both Home compositions show, for Bangkok's current day. */
export function useHomeReads(initialToday: CalendarDate) {
  const today = useToday(initialToday);
  const plan = createHomeQueryPlan(today);
  const { data: walletCollection } = useSuspenseQuery(plan.wallets);
  const { data: daily } = useSuspenseQuery(plan.daily);
  const { data: monthly } = useSuspenseQuery(plan.monthly);
  const { data: recent } = useSuspenseQuery(plan.recent);
  const arrive = useFirstShowing(walletCollection.items.length > 0);
  return {
    today,
    walletCollection,
    daily,
    monthly,
    recent: recent.items,
    arrive,
  };
}
