import type { ErrorComponentProps } from "@tanstack/react-router";
import { LoadError } from "@/core/shell/load-error";

/** Home's `errorComponent`. */
export function HomeErrorBoundary({ reset }: Readonly<ErrorComponentProps>) {
  return (
    <LoadError
      reset={reset}
      title="Home could not load"
      message="Try again to load your total, this month and your recent transactions. Your saved records are retained."
    />
  );
}
