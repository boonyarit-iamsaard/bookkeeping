import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { tagQueries } from "@/core/api/queries";
import {
  TagsDesktop,
  TagsDesktopLoading,
} from "@/features/tags/screens/tags.desktop";
import {
  TagsPhone,
  TagsPhoneLoading,
} from "@/features/tags/screens/tags.phone";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

function TagsPage() {
  const { data } = useSuspenseQuery(tagQueries.list());
  return useIsDesktop() ? (
    <TagsDesktop tags={data.items} />
  ) : (
    <TagsPhone tags={data.items} />
  );
}

function TagsLoading() {
  return useIsDesktop() ? <TagsDesktopLoading /> : <TagsPhoneLoading />;
}

export const Route = createFileRoute("/_app/tags/")({
  head: () => ({ meta: [{ title: "Tags" }] }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(tagQueries.list());
  },
  pendingComponent: TagsLoading,
  component: TagsPage,
});
