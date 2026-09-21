import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/wallets")({
  head: () => ({ meta: [{ title: "Wallets" }] }),
  component: WalletsPage,
});

// Placeholder until the wallets port (ticket 05); it only proves the guard.
function WalletsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8" />
  );
}
