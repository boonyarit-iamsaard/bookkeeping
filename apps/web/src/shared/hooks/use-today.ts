import type { CalendarDate } from "@bookkeeping/domain/dates";
import { APP_TIME_ZONE, addDays, todayIn } from "@bookkeeping/domain/dates";
import { useEffect, useState } from "react";

function readToday(now?: Date): CalendarDate {
  return todayIn({ timeZone: APP_TIME_ZONE, now });
}

/**
 * Today in the app's time zone, the one reader views and form hints share.
 * `initial` keeps a loader's date so its prefetched reads still match;
 * without it, the clock is read on first render. The value refreshes at
 * Bangkok midnight and when a sleeping page resumes.
 */
export function useToday(initial?: CalendarDate): CalendarDate {
  const [today, setToday] = useState(() => initial ?? readToday());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function refresh() {
      clearTimeout(timer);
      const now = new Date();
      const current = readToday(now);
      setToday(current);
      // Bangkok has a fixed UTC+07 offset and no daylight-saving transitions.
      const midnight = new Date(`${addDays(current, 1)}T00:00:00+07:00`);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime());
    }

    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return today;
}
