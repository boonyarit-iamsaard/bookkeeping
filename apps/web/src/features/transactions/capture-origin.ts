import { z } from "zod";
import type { CaptureLinkSearch } from "@/core/shell/capture-link-search";

const INTERNAL_ORIGIN = "https://bookkeeping.invalid";

interface CaptureLocation {
  pathname: string;
  searchStr: string;
}

export interface CaptureOrigin {
  pathname: string;
  search: string;
}

const searchValue = z.string().optional().catch(undefined);

/** Search parameters accepted by the new-entry route. */
export const captureSearchSchema = z.object({
  origin: searchValue,
  wallet: searchValue,
});

/** Builds capture link search from the screen's path, search, and optional wallet. */
export function captureSearchForLocation({
  pathname,
  searchStr,
}: Readonly<CaptureLocation>): CaptureLinkSearch {
  const walletId = walletIdFromPathname(pathname);
  return {
    origin: `${pathname}${searchStr}`,
    ...(walletId ? { wallet: walletId } : {}),
  };
}

/** Accepts only same-app absolute paths and preserves their query string. */
export function resolveCaptureOrigin(origin?: string): CaptureOrigin {
  if (
    !origin?.startsWith("/") ||
    origin.startsWith("//") ||
    origin.includes("\\")
  ) {
    return homeCaptureOrigin();
  }

  try {
    const url = new URL(origin, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN) {
      return homeCaptureOrigin();
    }
    return { pathname: url.pathname, search: url.search };
  } catch {
    return homeCaptureOrigin();
  }
}

/** Builds the return link for Cancel, dropping any earlier arrival marker. */
export function captureOriginHref(origin: Readonly<CaptureOrigin>): string {
  const url = urlForCaptureOrigin(origin);
  url.searchParams.delete("created");
  return `${url.pathname}${url.search}`;
}

/** Builds a return link with the newly created transaction marked for its list. */
export function captureReturnHref(
  origin: Readonly<CaptureOrigin>,
  transactionId: string,
): string {
  const url = urlForCaptureOrigin(origin);
  url.searchParams.delete("created");
  resetHistoryCursor(url);
  url.searchParams.set("created", transactionId);
  return `${url.pathname}${url.search}`;
}

function urlForCaptureOrigin(origin: Readonly<CaptureOrigin>): URL {
  return new URL(`${origin.pathname}${origin.search}`, INTERNAL_ORIGIN);
}

function resetHistoryCursor(url: URL): void {
  const isTransactionsHistory = url.pathname === "/transactions";
  const isWalletHistory = walletIdFromPathname(url.pathname) !== undefined;
  if (isTransactionsHistory || isWalletHistory) {
    url.searchParams.delete("cursor");
  }
}

function walletIdFromPathname(pathname: string): string | undefined {
  return /^\/wallets\/([^/]+)\/?$/.exec(pathname)?.[1];
}

function homeCaptureOrigin(): CaptureOrigin {
  return { pathname: "/", search: "" };
}
