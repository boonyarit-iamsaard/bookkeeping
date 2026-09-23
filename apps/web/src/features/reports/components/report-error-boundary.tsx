import type { ErrorComponentProps } from "@tanstack/react-router";
import { LoadError } from "@/core/shell/load-error";

/** Reports' `errorComponent`: retry reloads the same month and date. */
export function ReportErrorBoundary({ reset }: Readonly<ErrorComponentProps>) {
  return (
    <LoadError
      reset={reset}
      title="Your report could not load"
      message="Try again to load the month's figures and your wallet balances. Your saved records and the month and date in this address are retained."
    />
  );
}
