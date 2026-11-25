import type {
  CategoryKind,
  CategorySummary,
} from "@bookkeeping/domain/categories";
import { useState } from "react";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { createCategoryColors } from "@/features/categories/category-color";
import { searchCategories } from "@/features/categories/category-search";
import { CategoryTable } from "@/features/categories/components/category-table";
import {
  KIND_OPTIONS,
  KindSwitch,
} from "@/features/categories/components/kind-switch";
import { NewCategoryButton } from "@/features/categories/components/new-category-button";
import { useCategoryManagement } from "@/features/categories/hooks/use-category-management";
import { DashboardCard } from "@/shared/components/dashboard-card";
import { DashboardRow } from "@/shared/components/dashboard-row";
import { SavedNotice } from "@/shared/components/saved-notice";
import { TableCardSkeleton } from "@/shared/components/skeleton";
import { cn } from "@/shared/helpers/cn";

interface CategoriesDesktopProps {
  categories: readonly CategorySummary[];
  /** Current entry counts by category id; absent means none. */
  usage: Readonly<Record<string, number>>;
}

/** Both trees side by side, a table each; New category asks which tree. */
export function CategoriesDesktop({
  categories,
  usage,
}: Readonly<CategoriesDesktopProps>) {
  const [kind, setKind] = useState<CategoryKind>("expense");
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
            createLead={
              <div className="px-4 pb-2 sm:px-6">
                <KindSwitch kind={kind} onChange={setKind} />
              </div>
            }
          />
        }
      />
      <SavedNotice
        takeFocusOn={notice.takesFocus ? notice : undefined}
        className={cn(!notice.message && "sr-only")}
      >
        {notice.message}
      </SavedNotice>
      <DashboardRow className="grid-cols-2">
        {KIND_OPTIONS.map((option) => (
          <DashboardCard
            key={option.value}
            headingId={`${option.value}-categories-heading`}
            heading={option.label}
          >
            <CategoryTable
              label={`${option.label} categories`}
              groups={
                searchCategories({
                  categories,
                  kind: option.value,
                  query: "",
                }).groups
              }
              colorOf={colorOf}
              usage={usage}
              onDone={finishEdit}
            />
          </DashboardCard>
        ))}
      </DashboardRow>
    </Page>
  );
}

/** The desktop Categories page in neutral blocks: a table's card for each tree. */
export function CategoriesDesktopLoading() {
  return (
    <Page layout="wide" loading>
      <TitleBar title="Categories" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        <DashboardRow className="grid-cols-2">
          <TableCardSkeleton rows={4} />
          <TableCardSkeleton rows={4} />
        </DashboardRow>
      </div>
    </Page>
  );
}
