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
  return <div className={cn("bg-muted rounded-md", className)} />;
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

interface HeroSkeletonProps {
  /** Width classes for the caption bar under the figure. */
  captionClassName?: string;
}

/**
 * The hero card in waiting. It is the hero's own Midnight card, so the
 * screen does not change color when the figure arrives; its blocks wear a
 * faint hero tint.
 */
export function HeroSkeleton({
  captionClassName = "w-28",
}: Readonly<HeroSkeletonProps>) {
  return (
    <div className="bg-hero shadow-hero flex min-h-44 flex-col gap-3 rounded-3xl p-5 pt-6 sm:min-h-48 sm:p-7">
      <Skeleton className="bg-hero-foreground/12 h-4 w-24" />
      <Skeleton className="bg-hero-foreground/12 mt-auto h-9 w-52 sm:h-12 sm:w-72" />
      <Skeleton className={cn("bg-hero-foreground/12 h-4", captionClassName)} />
    </div>
  );
}
