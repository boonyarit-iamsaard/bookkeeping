declare module "react" {
  interface CSSProperties {
    /** Read by `styles/page-transitions.css` while a morph runs. */
    "--morph-name"?: string;
  }
}

/**
 * Marks one end of a morph. The card and the hero card it opens carry the
 * same name, and the screen change grows one into the other.
 */
export function morphProps(name: string) {
  return { "data-morph": "", style: { "--morph-name": name } };
}
