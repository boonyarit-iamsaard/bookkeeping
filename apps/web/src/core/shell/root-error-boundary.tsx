import type { ErrorComponentProps } from "@tanstack/react-router";
import { LoadError } from "@/core/shell/load-error";

/**
 * The router's default `errorComponent`: any route without its own, such as
 * the session read that gates every screen. Nothing is lost by retrying.
 */
export function RootErrorBoundary({ reset }: Readonly<ErrorComponentProps>) {
  return (
    <LoadError
      reset={reset}
      title="Could not reach your ledger"
      message="Check your connection and try again. Your saved records are retained."
    />
  );
}
