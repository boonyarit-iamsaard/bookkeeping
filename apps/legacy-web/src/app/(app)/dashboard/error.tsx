"use client";

import type { HistoryErrorProps } from "@/features/transactions/components/history-error";
import { HistoryError } from "@/features/transactions/components/history-error";

export default function HistoryErrorBoundary({
  retry,
}: Readonly<HistoryErrorProps>) {
  return <HistoryError retry={retry} />;
}
