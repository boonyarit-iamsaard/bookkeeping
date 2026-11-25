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
import { KindSwitch } from "@/features/categories/components/kind-switch";
import { NewCategoryButton } from "@/features/categories/components/new-category-button";
import { useCategoryManagement } from "@/features/categories/hooks/use-category-management";
import { listCardClass } from "@/shared/components/list-section";
import { SavedNotice } from "@/shared/components/saved-notice";
import { RowSkeleton, Skeleton } from "@/shared/components/skeleton";
import { cn } from "@/shared/helpers/cn";

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

  const { notice, announce, finishEdit } = useCategoryManagement();

  return (
    <Page layout="wide">
      <TitleBar
        title="Categories"
        actions={
          <NewCategoryButton
            categories={categories}
            kind={kind}
            onCreated={announce}
          />
        }
      />
      <SavedNotice
        takeFocusOn={notice.takesFocus ? notice : undefined}
        className={cn(!notice.message && "sr-only")}
      >
        {notice.message}
      </SavedNotice>
      <KindSwitch kind={kind} onChange={setKind} />
      <CategoryList
        label={`${CATEGORY_KIND_LABELS[kind]} categories`}
        groups={groups}
        colorOf={colorOf}
        usage={usage}
        onDone={finishEdit}
      />
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
        <Skeleton className="h-11 w-52" />
        <div className={listCardClass}>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </div>
    </Page>
  );
}
