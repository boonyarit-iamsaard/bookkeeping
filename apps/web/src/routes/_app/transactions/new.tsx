import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  categoryQueries,
  tagQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { isSignedInPathname } from "@/core/router/router";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import {
  captureOriginHref,
  captureSearchSchema,
  parseCaptureOrigin,
} from "@/features/transactions/capture-origin";
import { RecordTransaction } from "@/features/transactions/components/record-transaction";
import { TransactionFormDesktop } from "@/features/transactions/screens/transaction-form.desktop";
import { TransactionFormPhone } from "@/features/transactions/screens/transaction-form.phone";
import { buttonVariants } from "@/shared/components/ui/button";
import { isPlainClick } from "@/shared/helpers/plain-click";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

function NewTransactionPage() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const search = Route.useSearch();
  const captureOrigin = parseCaptureOrigin(search.origin, (pathname) =>
    isSignedInPathname(router, pathname),
  );
  const returnHref = captureOriginHref(captureOrigin);

  return (
    <Page layout={desktop ? "column" : "entry"}>
      <TitleBar
        title="New transaction"
        actions={
          // The desktop form's footer carries Cancel. Link requires a typed
          // `to`; the origin is a built path, so a plain anchor navigates
          // in-app and leaves modified clicks to the browser.
          !desktop && (
            <a
              href={returnHref}
              onClick={(event) => {
                if (isPlainClick(event)) {
                  event.preventDefault();
                  void router.navigate({ href: returnHref });
                }
              }}
              className={buttonVariants({
                variant: "ghost",
                size: "lg",
                className: "-mr-3",
              })}
            >
              Cancel
            </a>
          )
        }
      />
      <RecordTransaction
        captureOrigin={captureOrigin}
        requestedWalletId={search.wallet}
        formComponent={desktop ? TransactionFormDesktop : TransactionFormPhone}
      />
    </Page>
  );
}

export const Route = createFileRoute("/_app/transactions/new")({
  head: () => ({ meta: [{ title: "New transaction" }] }),
  validateSearch: captureSearchSchema,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(walletQueries.list()),
      context.queryClient.ensureQueryData(categoryQueries.list()),
      context.queryClient.ensureQueryData(tagQueries.list()),
      context.queryClient.ensureQueryData(transactionQueries.entryDefaults()),
    ]);
  },
  staticData: { form: true },
  component: NewTransactionPage,
});
