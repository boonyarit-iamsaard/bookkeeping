import type { Metadata, Viewport } from "next";
import { cn } from "@/shared/helpers/cn";
import { fontMono, fontSans } from "@/styles/fonts";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Bookkeeping",
};

/**
 * Lets the layout viewport shrink when the on-screen keyboard opens, so the
 * fixed Save bar and the category sheet stay above it instead of underneath.
 */
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        "font-sans",
        fontSans.variable,
        fontMono.variable,
      )}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
