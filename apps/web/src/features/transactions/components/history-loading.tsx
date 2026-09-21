export function HistoryLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading financial history"
      className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8"
    >
      <output className="text-muted-foreground text-sm">
        Loading your records…
      </output>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="h-8 w-52 rounded bg-muted" />
        <div className="h-64 rounded-xl bg-muted" />
        <div className="h-16 rounded bg-muted" />
        <div className="h-16 rounded bg-muted" />
        <div className="h-16 rounded bg-muted" />
      </div>
    </main>
  );
}
