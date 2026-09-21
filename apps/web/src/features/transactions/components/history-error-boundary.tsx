import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { HistoryError } from "@/features/transactions/components/history-error";

/** The transaction routes' `errorComponent`: retry reloads the same address. */
export function HistoryErrorBoundary({ reset }: Readonly<ErrorComponentProps>) {
  const router = useRouter();
  function retry() {
    reset();
    void router.invalidate();
  }
  return <HistoryError retry={retry} />;
}
