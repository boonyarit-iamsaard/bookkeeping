import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { tagQueries } from "@/core/api/queries";
import { Page } from "@/core/shell/page";
import { TagManagement } from "@/features/tags/components/tag-management";

export const Route = createFileRoute("/_app/tags/")({
  head: () => ({ meta: [{ title: "Tags" }] }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(tagQueries.list());
  },
  component: TagsPage,
});

function TagsPage() {
  const { data } = useSuspenseQuery(tagQueries.list());
  if (!data) {
    throw new Error("The tags query returned no data");
  }
  return (
    <Page layout="wide">
      <TagManagement tags={data.items} />
    </Page>
  );
}
