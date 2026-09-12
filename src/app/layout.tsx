import type { Metadata } from "next";
import { cn } from "@/shared/helpers/cn";
import { fontMono, fontSans } from "@/styles/fonts";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Bookkeeping",
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
