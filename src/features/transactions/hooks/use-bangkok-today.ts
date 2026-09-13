"use client";

import { useEffect, useState } from "react";
import type { CalendarDate } from "@/shared/helpers/dates";
import { APP_TIME_ZONE, addDays, todayIn } from "@/shared/helpers/dates";

/** Refresh shortcuts at Bangkok midnight and when a sleeping page resumes. */
export function useBangkokToday(initialToday: CalendarDate) {
  const [today, setToday] = useState(initialToday);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function refresh() {
      clearTimeout(timer);
      const now = new Date();
      const current = todayIn({ timeZone: APP_TIME_ZONE, now });
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
