import type { LucideProps } from "lucide-react";
import { iconById } from "@/features/categories/icons";

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
