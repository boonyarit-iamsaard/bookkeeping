import { useMatches } from "@tanstack/react-router";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /**
     * A form screen: its Save bar owns the thumb zone on phone, so the tab
     * bar steps aside. Declared on the route so the shell knows before the
     * screen renders.
     */
    form?: boolean;
  }
}

/** Whether the screen on show declared itself a form. */
export function useIsFormScreen(): boolean {
  return useMatches({
    select: (matches) => matches.some((match) => match.staticData.form),
  });
}
