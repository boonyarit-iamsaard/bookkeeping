/**
 * Where an old `/dashboard` link lands. The query string is carried verbatim,
 * so bookmarks keep their month and balance date, and a malformed value still
 * reaches Reports' editable invalid controls.
 */
export function dashboardRedirectHref(searchStr: string): string {
  return `/reports${searchStr}`;
}
