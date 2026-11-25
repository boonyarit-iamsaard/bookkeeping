import type {
  CategoryKind,
  CategorySummary,
} from "@bookkeeping/domain/categories";
import { useState } from "react";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { createCategoryColors } from "@/features/categories/category-color";
import { searchCategories } from "@/features/categories/category-search";
import { CategoryManagement } from "@/features/categories/components/category-management";
import { CategoryTable } from "@/features/categories/components/category-table";
import {
  KIND_OPTIONS,
  KindSwitch,
} from "@/features/categories/components/kind-switch";
import { DashboardCard } from "@/shared/components/dashboard-card";
import { DashboardRow } from "@/shared/components/dashboard-row";
import { TableCardSkeleton } from "@/shared/components/skeleton";

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

  return (
    <Page layout="wide">
      <CategoryManagement
        categories={categories}
        kind={kind}
        createLead={
          <div className="px-4 pb-2 sm:px-6">
            <KindSwitch kind={kind} onChange={setKind} />
          </div>
        }
      >
        {(onDone) => (
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
                  onDone={onDone}
                />
              </DashboardCard>
            ))}
          </DashboardRow>
        )}
      </CategoryManagement>
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
