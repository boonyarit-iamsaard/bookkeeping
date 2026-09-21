import type { LucideProps } from "lucide-react";
import { iconById } from "@/features/categories/icons";
import { cn } from "@/shared/helpers/cn";

interface CategoryIconProps extends LucideProps {
  iconId: string;
}

/** Decorative: the category is always named in text beside it. */
export function CategoryIcon({
  iconId,
  ...props
}: Readonly<CategoryIconProps>) {
  const Icon = iconById(iconId);
  return <Icon aria-hidden="true" strokeWidth={1.75} {...props} />;
}

interface CategoryDiscProps {
  iconId: string;
  /** Children take the smaller disc so the hierarchy reads at a glance. */
  size?: "parent" | "child";
  className?: string;
}

/** The pictogram in its Mist disc, as every category row leads with it. */
export function CategoryDisc({
  iconId,
  size = "parent",
  className,
}: Readonly<CategoryDiscProps>) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted text-foreground",
        size === "parent" ? "size-10" : "size-8",
        className,
      )}
    >
      <CategoryIcon
        iconId={iconId}
        className={size === "parent" ? "size-5" : "size-4"}
      />
    </span>
  );
}
