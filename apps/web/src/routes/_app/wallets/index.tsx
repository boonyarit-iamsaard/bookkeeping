import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { walletQueries } from "@/core/api/queries";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { AccountMenu } from "@/features/auth/components/account-menu";
import { WalletList } from "@/features/wallets/components/wallet-list";
import { buttonVariants } from "@/shared/components/ui/button";

interface WalletsSearch {
  created?: string;
}

export const Route = createFileRoute("/_app/wallets/")({
  head: () => ({ meta: [{ title: "Wallets" }] }),
  validateSearch: (search): WalletsSearch => ({
    created: typeof search.created === "string" ? search.created : undefined,
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(walletQueries.list()),
  component: WalletsPage,
});

function WalletsPage() {
  const { data } = useSuspenseQuery(walletQueries.list());
  const { created } = Route.useSearch();
  const { session } = Route.useRouteContext();
  if (!data) {
    throw new Error("The wallets query returned no data");
  }

  return (
    <Page layout="wide">
      <TitleBar
        title="Wallets"
        actions={
          <>
            {data.items.length > 0 && (
              <Link
                to="/wallets/new"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <Plus data-icon="inline-start" />
                New wallet
              </Link>
            )}
            {/* Until Home's avatar sheet, the phone reaches its account here. */}
            <div className="sm:hidden">
              <AccountMenu email={session.user.email} />
            </div>
          </>
        }
      />
      <WalletList wallets={data.items} createdId={created} />
    </Page>
  );
}
