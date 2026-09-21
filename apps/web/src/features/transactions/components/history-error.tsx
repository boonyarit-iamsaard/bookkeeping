import { Button } from "@/shared/components/ui/button";

export interface HistoryErrorProps {
  retry: () => void;
}

export function HistoryError({ retry }: Readonly<HistoryErrorProps>) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 py-8">
      <h1 className="font-semibold text-2xl tracking-tight">
        Your records could not load
      </h1>
      <p role="alert" className="text-muted-foreground text-sm">
        Try again to load your history and totals. Your saved records and the
        filters in this address are retained.
      </p>
      <Button onClick={retry} size="lg">
        Try again
      </Button>
    </main>
  );
}
