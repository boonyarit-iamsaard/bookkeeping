import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { Skeleton } from "@/shared/components/skeleton";

/** A summary card in neutral blocks. */
export function SummarySkeleton() {
  return (
    <div className="bg-card shadow-card flex flex-col gap-5 rounded-2xl p-5 sm:p-6">
      <Skeleton className="h-5 w-24" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
      <Skeleton className="h-6" />
      <Skeleton className="h-24" />
    </div>
  );
}

/** A desktop month figure tile in neutral blocks. */
export function TileSkeleton() {
  return (
    <div className="bg-card shadow-card flex flex-col rounded-2xl p-6">
      <Skeleton className="h-7 w-28" />
      <Skeleton className="mt-auto h-8 w-36" />
      <Skeleton className="mt-2 h-4 w-32" />
    </div>
  );
}

interface HomeLoadingProps {
  children: React.ReactNode;
}

/** Home's frame around a composition's skeleton: never a figure that could pass for money. */
export function HomeLoading({ children }: Readonly<HomeLoadingProps>) {
  return (
    <Page layout="wide" loading>
      <TitleBar title="Home" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        {children}
      </div>
    </Page>
  );
}
