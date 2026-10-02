import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { cn } from "cn";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border border-transparent bg-clip-padding font-semibold text-sm outline-none transition-[color,background-color,border-color,box-shadow,opacity] duration-150 ease-out focus-visible:ring-[3px] focus-visible:ring-ring/45 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 motion-reduce:transition-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Iris fill for the screen's action, deepening on hover.
        default:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_12%)]",
        // A white chip on the tinted ground: the neutral page action.
        outline:
          "border-border bg-card text-foreground hover:bg-accent aria-expanded:bg-accent",
        // Tonal Iris, for a quieter positive action beside the primary.
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--primary)_10%)] aria-expanded:bg-secondary",
        ghost: "text-foreground hover:bg-accent aria-expanded:bg-accent",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/16 focus-visible:ring-destructive/25 dark:bg-destructive/16 dark:hover:bg-destructive/24",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        // The app-facing sizes are 44px tappable areas below 640px; desktop
        // keeps its heights from 640px. `xs`, `sm`, `icon-xs` and `icon-sm`
        // are unused app sizes and stay small.
        default:
          "h-11 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 sm:h-9",
        xs: "h-6 gap-1 rounded-sm px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-md px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-11 gap-2 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5 sm:h-10",
        icon: "size-11 sm:size-9",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-11 sm:size-10",
        "icon-touch": "size-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

/**
 * A quiet action standing alone beneath its explanatory text: the link
 * variant carrying a 44px target in both dimensions at every width.
 */
const linkActionClass = cn(
  buttonVariants({ variant: "link", size: null }),
  "h-11 min-w-11",
);

export { Button, buttonVariants, linkActionClass };
