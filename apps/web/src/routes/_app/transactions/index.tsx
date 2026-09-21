import { createFileRoute } from "@tanstack/react-router";

interface TransactionsSearch {
  created?: string;
}

export const Route = createFileRoute("/_app/transactions/")({
  head: () => ({ meta: [{ title: "Transactions" }] }),
  validateSearch: (search): TransactionsSearch => ({
    created: typeof search.created === "string" ? search.created : undefined,
  }),
  component: TransactionsPlaceholderPage,
});

/** The history screen is ported in the next transaction ticket. */
function TransactionsPlaceholderPage() {
  const { created } = Route.useSearch();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <h1 className="font-semibold text-2xl tracking-tight">Transactions</h1>
      {created && (
        <output className="rounded-xl border bg-muted px-4 py-3 text-sm">
          Transaction created.
        </output>
      )}
    </main>
  );
}
