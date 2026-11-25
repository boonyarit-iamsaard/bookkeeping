import type {
  CategoryKind,
  CategorySummary,
} from "@bookkeeping/domain/categories";
import { useState } from "react";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { createCategoryColors } from "@/features/categories/category-color";
import { CATEGORY_KIND_LABELS } from "@/features/categories/category-labels";
import { searchCategories } from "@/features/categories/category-search";
import { CategoryList } from "@/features/categories/components/category-list";
import { CategoryManagement } from "@/features/categories/components/category-management";
import { KindSwitch } from "@/features/categories/components/kind-switch";
import { TableCardSkeleton } from "@/shared/components/skeleton";

interface CategoriesPhoneProps {
  categories: readonly CategorySummary[];
  /** Current entry counts by category id; absent means none. */
  usage: Readonly<Record<string, number>>;
}

/** One tree at a time behind a segmented switch; New category creates in it. */
export function CategoriesPhone({
  categories,
  usage,
}: Readonly<CategoriesPhoneProps>) {
  const [kind, setKind] = useState<CategoryKind>("expense");
  const { groups } = searchCategories({ categories, kind, query: "" });
  const colorOf = createCategoryColors(categories);

  return (
    <Page layout="wide">
      <CategoryManagement categories={categories} kind={kind}>
        {(onDone) => (
          <>
            <KindSwitch kind={kind} onChange={setKind} />
            <CategoryList
              label={`${CATEGORY_KIND_LABELS[kind]} categories`}
              groups={groups}
              colorOf={colorOf}
              usage={usage}
              onDone={onDone}
            />
          </>
        )}
      </CategoryManagement>
    </Page>
  );
}

/** The phone Categories page in neutral blocks: one tree's card. */
export function CategoriesPhoneLoading() {
  return (
    <Page layout="wide" loading>
      <TitleBar title="Categories" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        <TableCardSkeleton rows={4} />
      </div>
    </Page>
  );
}
