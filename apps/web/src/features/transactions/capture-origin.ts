import { z } from "zod";
import type { CaptureLinkSearch } from "@/core/shell/capture-link-search";
import type { HistorySearch } from "@/features/transactions/history-schema";

const INTERNAL_ORIGIN = "https://bookkeeping.invalid";
const ARRIVAL_KEY = "created" satisfies keyof HistorySearch;
const CURSOR_KEY = "cursor" satisfies keyof HistorySearch;

interface CaptureLocation {
  pathname: string;
  searchStr: string;
}

export interface CaptureOrigin {
  pathname: string;
  search: string;
}

const searchValue = z.string().optional().catch(undefined);

/** Search parameters accepted by the capture route. */
export const captureSearchSchema = z.object({
  origin: searchValue,
  wallet: searchValue,
});

function pathWithSearch({ pathname, search }: Readonly<CaptureOrigin>): string {
  return `${pathname}${search}`;
}

function urlForCaptureOrigin(origin: Readonly<CaptureOrigin>): URL {
  return new URL(pathWithSearch(origin), INTERNAL_ORIGIN);
}

function homeCaptureOrigin(): CaptureOrigin {
  return { pathname: "/", search: "" };
}

function isCapturePathname(pathname: string): boolean {
  // Route matching ignores case, so capture is recognised in any case too.
  return /^\/transactions\/new\/?$/i.test(pathname);
}

function walletIdFromPathname(pathname: string): string | undefined {
  const walletId = /^\/wallets\/([^/]+)\/?$/.exec(pathname)?.[1];
  return walletId === "new" ? undefined : walletId;
}

function resetHistoryCursor(url: URL): void {
  const isTransactionsHistory = url.pathname === "/transactions";
  const isWalletHistory = walletIdFromPathname(url.pathname) !== undefined;
  if (isTransactionsHistory || isWalletHistory) {
    url.searchParams.delete(CURSOR_KEY);
  }
}

function captureLinkSearch(
  origin: string,
  wallet: string | undefined,
): CaptureLinkSearch {
  return wallet ? { origin, wallet } : { origin };
}

/**
 * Accepts only same-app absolute paths to a signed-in screen other than capture,
 * keeping their query string.
 */
export function parseCaptureOrigin(
  origin: string | undefined,
  isSignedInPathname: (pathname: string) => boolean,
): CaptureOrigin {
  if (
    !origin?.startsWith("/") ||
    origin.startsWith("//") ||
    origin.includes("\\")
  ) {
    return homeCaptureOrigin();
  }

  try {
    const url = new URL(origin, INTERNAL_ORIGIN);
    if (
      url.origin !== INTERNAL_ORIGIN ||
      isCapturePathname(url.pathname) ||
      !isSignedInPathname(url.pathname)
    ) {
      return homeCaptureOrigin();
    }
    return { pathname: url.pathname, search: url.search };
  } catch {
    return homeCaptureOrigin();
  }
}

/**
 * Builds capture link search from the screen's path, search, and optional
 * wallet. On capture itself the link passes on capture's own origin and
 * wallet, which the capture screen parses.
 */
export function captureSearchForLocation({
  pathname,
  searchStr,
}: Readonly<CaptureLocation>): CaptureLinkSearch {
  if (isCapturePathname(pathname)) {
    const search = captureSearchSchema.parse(
      Object.fromEntries(new URLSearchParams(searchStr)),
    );
    return captureLinkSearch(
      search.origin ?? pathWithSearch(homeCaptureOrigin()),
      search.wallet,
    );
  }

  return captureLinkSearch(
    pathWithSearch({ pathname, search: searchStr }),
    walletIdFromPathname(pathname),
  );
}

/** Builds the return link for Cancel, dropping any earlier arrival marker. */
export function captureOriginHref(origin: Readonly<CaptureOrigin>): string {
  const url = urlForCaptureOrigin(origin);
  url.searchParams.delete(ARRIVAL_KEY);
  return pathWithSearch(url);
}

/** Builds a return link with the newly created transaction marked for its list. */
export function captureReturnHref(
  origin: Readonly<CaptureOrigin>,
  transactionId: string,
): string {
  const url = urlForCaptureOrigin(origin);
  resetHistoryCursor(url);
  url.searchParams.set(ARRIVAL_KEY, transactionId);
  return pathWithSearch(url);
}
