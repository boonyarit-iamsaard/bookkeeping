// Plain value set, kept apart from the Drizzle table so client code can
// import it without pulling drizzle-orm into its bundle.
export const CATEGORY_KINDS = ["income", "expense"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export interface CategorySummary {
  id: string;
  kind: CategoryKind;
  parentId: string | null;
  name: string;
  iconId: string;
  isProtected: boolean;
}

export const UNCATEGORIZED_NAME = "Uncategorized";

/**
 * The icon catalog id every client renders as the fallback glyph. Persisted
 * on Uncategorized; the catalog itself is presentation and stays with the app.
 */
export const GENERIC_ICON_ID = "generic";

/** The shared defensive bound for category names. */
export const MAX_CATEGORY_NAME_LENGTH = 60;

/** Surrounding whitespace never counts; inner spacing is kept as typed. */
export function normalizeCategoryName(raw: string): string {
  return raw.trim();
}

/** Stable category icon identifiers without any presentation or glyph code. */
export const CATEGORY_ICON_IDS = [
  "generic",
  "banknote",
  "briefcase",
  "coins",
  "hand-coins",
  "trending",
  "piggy-bank",
  "wallet",
  "dollar",
  "bitcoin",
  "sparkles",
  "utensils",
  "cart",
  "coffee",
  "pizza",
  "salad",
  "apple",
  "cake",
  "ice-cream",
  "beer",
  "wine",
  "martini",
  "package",
  "car",
  "taxi",
  "bus",
  "train",
  "bike",
  "fuel",
  "parking",
  "wrench",
  "truck",
  "house",
  "plug",
  "lightbulb",
  "droplets",
  "flame",
  "wifi",
  "phone",
  "key",
  "hammer",
  "paintbrush",
  "sofa",
  "bed",
  "bath",
  "washing-machine",
  "sprout",
  "flower",
  "bag",
  "shirt",
  "laptop",
  "smartphone",
  "monitor",
  "headphones",
  "watch",
  "gem",
  "glasses",
  "store",
  "scissors",
  "heart",
  "heart-pulse",
  "stethoscope",
  "hospital",
  "pill",
  "dumbbell",
  "trophy",
  "film",
  "tv",
  "music",
  "guitar",
  "gamepad",
  "ticket",
  "party",
  "camera",
  "palette",
  "book",
  "star",
  "baby",
  "hand-heart",
  "gift",
  "dog",
  "cat",
  "paw",
  "church",
  "graduation-cap",
  "school",
  "book-open",
  "pencil",
  "backpack",
  "building",
  "calculator",
  "file",
  "mail",
  "plane",
  "hotel",
  "luggage",
  "map-pin",
  "globe",
  "tent",
  "ship",
  "anchor",
  "umbrella",
  "receipt",
  "credit-card",
  "shield",
  "landmark",
  "percent",
] as const;

export type CategoryIconId = (typeof CATEGORY_ICON_IDS)[number];

const CATEGORY_ICON_ID_SET: ReadonlySet<string> = new Set(CATEGORY_ICON_IDS);

export function isCategoryIconId(value: string): value is CategoryIconId {
  return CATEGORY_ICON_ID_SET.has(value);
}
