import { Link } from "@tanstack/react-router";
import { MapPinOff } from "lucide-react";
import { EmptyState } from "@/shared/components/empty-state";
import { buttonVariants } from "@/shared/components/ui/button";

/** An address that matches no screen, as an empty state with one way back. */
export function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col px-4 py-6 sm:py-8">
      <EmptyState
        icon={MapPinOff}
        headingId="not-found-heading"
        title="Page not found"
        description="This address does not lead to a screen. Your records are untouched."
        action={
          <Link to="/" className={buttonVariants({ size: "lg" })}>
            Go to Home
          </Link>
        }
      />
    </main>
  );
}
