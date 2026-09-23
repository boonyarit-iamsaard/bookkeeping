import { createFileRoute, redirect } from "@tanstack/react-router";
import { dashboardRedirectHref } from "@/features/reports/dashboard-redirect";

/** The monthly summary's old address; bookmarks land on Reports. */
export const Route = createFileRoute("/_app/dashboard")({
  beforeLoad: ({ location }) => {
    throw redirect({
      href: dashboardRedirectHref(location.searchStr),
      replace: true,
    });
  },
});
