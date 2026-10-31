/**
 * How one screen gives way to the next. Each type names a motion in
 * `styles/page-transitions.css`; `false` changes the screen without one.
 */
export type PageTransitionType =
  | "page-push"
  | "page-pop"
  | "page-swap"
  | "page-rise"
  | "page-fall"
  | "page-load"
  | "morph";

export interface PageTransitionOptions {
  /** The pathname on show, or none on the app's first load. */
  fromPathname: string | undefined;
  toPathname: string;
  reducedMotion: boolean;
  /** A loading skeleton is on show, so the content crossfades in over it. */
  loading: boolean;
}

const CAPTURE_PATHNAME = "/transactions/new";
const AUTH_PATHNAMES = new Set(["/sign-in", "/sign-up"]);
const WALLET_PAGE = /^\/wallets\/(?!new$)[^/]+$/;

/** "/transactions/" and "/transactions" are one screen. */
function trimSlash(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/** Tabs are depth 1, a record 2, and that record's edit or manage screen 3. */
function depth(pathname: string) {
  return Math.max(pathname.split("/").filter(Boolean).length, 1);
}

/** Whether the wallet card and its page's hero card are the two ends. */
function isWalletMorph(from: string, to: string) {
  return (
    (from === "/wallets" && WALLET_PAGE.test(to)) ||
    (to === "/wallets" && WALLET_PAGE.test(from))
  );
}

/**
 * Tabs crossfade, going deeper pushes and coming back pops, and capture
 * rises like a sheet. A search-only change, such as a filter or a month,
 * stays on its screen and moves nothing.
 */
export function pageTransitionTypes({
  fromPathname: rawFrom,
  toPathname: rawTo,
  reducedMotion,
  loading,
}: Readonly<PageTransitionOptions>): PageTransitionType[] | false {
  if (reducedMotion || rawFrom === undefined) {
    return false;
  }
  const fromPathname = trimSlash(rawFrom);
  const toPathname = trimSlash(rawTo);
  if (fromPathname === toPathname) {
    return false;
  }
  if (loading) {
    return ["page-load"];
  }
  if (toPathname === CAPTURE_PATHNAME) {
    return ["page-rise"];
  }
  if (fromPathname === CAPTURE_PATHNAME) {
    return ["page-fall"];
  }
  if (AUTH_PATHNAMES.has(fromPathname) || AUTH_PATHNAMES.has(toPathname)) {
    return ["page-swap"];
  }
  const step = depth(toPathname) - depth(fromPathname);
  if (step === 0) {
    return ["page-swap"];
  }
  const direction = step > 0 ? "page-push" : "page-pop";
  return isWalletMorph(fromPathname, toPathname)
    ? [direction, "morph"]
    : [direction];
}
