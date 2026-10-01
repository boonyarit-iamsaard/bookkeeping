import { cn } from "@/shared/helpers/cn";

interface SkeletonProps {
  className?: string;
}

/**
 * A neutral block standing in for content while it loads. It never holds a
 * figure that could pass for money, and it stays still: loading is not a
 * motion moment.
 */
export function Skeleton({ className }: Readonly<SkeletonProps>) {
  return <div className={cn("rounded-md bg-muted", className)} />;
}

/** A transaction or wallet row in waiting: tile, two lines, a figure. */
export function RowSkeleton() {
  return (
    <div className="flex min-h-16 items-center gap-3.5 px-4 py-3">
      <Skeleton className="size-11 shrink-0 rounded-lg" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-4 w-20" />
    </div>
  );
}
