import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { categoryQueries } from "@/core/api/queries";
import { Page } from "@/core/shell/page";
import { CategoryManagement } from "@/features/categories/components/category-management";

export const Route = createFileRoute("/_app/categories/")({
  head: () => ({ meta: [{ title: "Categories" }] }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(categoryQueries.list()),
      context.queryClient.ensureQueryData(categoryQueries.usage()),
    ]);
  },
  component: CategoriesPage,
});

function CategoriesPage() {
  const { data: categoryCollection } = useSuspenseQuery(categoryQueries.list());
  const { data: usageCollection } = useSuspenseQuery(categoryQueries.usage());
  if (!categoryCollection || !usageCollection) {
    throw new Error("The categories queries returned no data");
  }
  const usage = Object.fromEntries(
    usageCollection.items.map((entry) => [
      entry.categoryId,
      entry.transactions,
    ]),
  );

  return (
    <Page layout="wide">
      <CategoryManagement categories={categoryCollection.items} usage={usage} />
    </Page>
  );
}
