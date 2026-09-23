import type { ErrorComponentProps } from "@tanstack/react-router";
import { LoadError } from "@/core/shell/load-error";

/** The transaction routes' `errorComponent`: retry reloads the same address. */
export function HistoryErrorBoundary({ reset }: Readonly<ErrorComponentProps>) {
  return (
    <LoadError
      reset={reset}
      title="Your records could not load"
      message="Try again to load your history and totals. Your saved records and the filters in this address are retained."
    />
  );
}
