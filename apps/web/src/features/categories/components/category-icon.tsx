import type { LucideProps } from "lucide-react";
import type { CategoryColor } from "@/features/categories/category-color";
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

interface CategoryTileProps {
  color: CategoryColor;
  /** A child category in a tree steps down to the 36px tile. */
  size?: "row" | "child";
  children: React.ReactNode;
  className?: string;
}

/**
 * A row's leading pictogram on a rounded tile tinted with its category's
 * color; neutral for Uncategorized and transfers. Decorative: the row names
 * the category in text.
 */
export function CategoryTile({
  color,
  size = "row",
  children,
  className,
}: Readonly<CategoryTileProps>) {
  return (
    <span
      data-hue={color}
      className={cn(
        "hue-tile flex shrink-0 items-center justify-center",
        size === "row"
          ? "size-11 rounded-lg [&_svg]:size-5"
          : "size-9 rounded-md [&_svg]:size-4",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A child row's leading ›, centred in a 44px slot beneath its parent's
 * tile so the tree reads at a glance. Decorative; the list says the level.
 */
export function ChildMarker() {
  return (
    <span
      aria-hidden="true"
      className="w-11 shrink-0 text-center text-lg text-muted-foreground leading-none"
    >
      ›
    </span>
  );
}
