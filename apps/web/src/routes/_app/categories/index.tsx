import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { categoryQueries } from "@/core/api/queries";
import {
  CategoriesDesktop,
  CategoriesDesktopLoading,
} from "@/features/categories/screens/categories.desktop";
import {
  CategoriesPhone,
  CategoriesPhoneLoading,
} from "@/features/categories/screens/categories.phone";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

function CategoriesPage() {
  const { data: categoryCollection } = useSuspenseQuery(categoryQueries.list());
  const { data: usageCollection } = useSuspenseQuery(categoryQueries.usage());
  const usage = Object.fromEntries(
    usageCollection.items.map((entry) => [
      entry.categoryId,
      entry.transactions,
    ]),
  );

  return useIsDesktop() ? (
    <CategoriesDesktop categories={categoryCollection.items} usage={usage} />
  ) : (
    <CategoriesPhone categories={categoryCollection.items} usage={usage} />
  );
}

function CategoriesLoading() {
  return useIsDesktop() ? (
    <CategoriesDesktopLoading />
  ) : (
    <CategoriesPhoneLoading />
  );
}

export const Route = createFileRoute("/_app/categories/")({
  head: () => ({ meta: [{ title: "Categories" }] }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(categoryQueries.list()),
      context.queryClient.ensureQueryData(categoryQueries.usage()),
    ]);
  },
  pendingComponent: CategoriesLoading,
  component: CategoriesPage,
});
