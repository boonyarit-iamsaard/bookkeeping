import type { CategoryIconId } from "@bookkeeping/domain/categories";
import {
  GENERIC_ICON_ID,
  isCategoryIconId,
} from "@bookkeeping/domain/categories";
import type { LucideProps } from "lucide-react";
import {
  Anchor,
  Apple,
  Baby,
  Backpack,
  Banknote,
  Bath,
  Bed,
  Beer,
  Bike,
  Bitcoin,
  Book,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Bus,
  Cake,
  Calculator,
  Camera,
  Car,
  CarTaxiFront,
  Cat,
  Church,
  CircleDollarSign,
  Coffee,
  Coins,
  CreditCard,
  Dog,
  Droplets,
  Dumbbell,
  FileText,
  Film,
  Flame,
  Flower2,
  Fuel,
  Gamepad2,
  Gem,
  Gift,
  Glasses,
  Globe,
  GraduationCap,
  Guitar,
  Hammer,
  HandCoins,
  HandHeart,
  Headphones,
  Heart,
  HeartPulse,
  Hospital,
  Hotel,
  House,
  IceCreamCone,
  Key,
  Landmark,
  Laptop,
  Lightbulb,
  Luggage,
  Mail,
  MapPin,
  Martini,
  Monitor,
  Music,
  Package,
  Paintbrush,
  Palette,
  ParkingCircle,
  PartyPopper,
  PawPrint,
  Pencil,
  Percent,
  Phone,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Plug,
  Receipt,
  Salad,
  School,
  Scissors,
  Shield,
  Ship,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sofa,
  Sparkles,
  Sprout,
  Star,
  Stethoscope,
  Store,
  Tag,
  Tent,
  Ticket,
  TrainFront,
  TrendingUp,
  Trophy,
  Truck,
  Tv,
  Umbrella,
  Utensils,
  Wallet,
  WashingMachine,
  Watch,
  Wifi,
  Wine,
  Wrench,
} from "lucide-react";

/** Browsing groups, in display order. Presentation only: never a category. */
export const ICON_GROUPS = [
  { id: "money", label: "Money & income" },
  { id: "food", label: "Food & drink" },
  { id: "transport", label: "Transport" },
  { id: "home", label: "Home & utilities" },
  { id: "shopping", label: "Shopping" },
  { id: "health", label: "Health & fitness" },
  { id: "leisure", label: "Leisure" },
  { id: "family", label: "Family & pets" },
  { id: "work", label: "Work & education" },
  { id: "travel", label: "Travel" },
  { id: "finance", label: "Fees & finance" },
  { id: "general", label: "General" },
] as const;

export type IconGroupId = (typeof ICON_GROUPS)[number]["id"];

export interface IconDefinition {
  /** Permanent, unique; the only thing persisted on a category. */
  readonly id: IconId;
  readonly glyph: React.ComponentType<LucideProps>;
  readonly group: IconGroupId;
}

/**
 * The stable icon catalog. Ids are permanent references persisted on
 * categories; the Lucide glyph behind an id may change, the id never does.
 * Unknown or retired ids render the generic icon without being rewritten.
 * Catalog order is the deterministic tie-break for recommendations.
 */
const DEFINITIONS = [
  { id: "generic", glyph: Tag, group: "general" },

  // Money & income
  { id: "banknote", glyph: Banknote, group: "money" },
  { id: "briefcase", glyph: BriefcaseBusiness, group: "money" },
  { id: "coins", glyph: Coins, group: "money" },
  { id: "hand-coins", glyph: HandCoins, group: "money" },
  { id: "trending", glyph: TrendingUp, group: "money" },
  { id: "piggy-bank", glyph: PiggyBank, group: "money" },
  { id: "wallet", glyph: Wallet, group: "money" },
  { id: "dollar", glyph: CircleDollarSign, group: "money" },
  { id: "bitcoin", glyph: Bitcoin, group: "money" },
  { id: "sparkles", glyph: Sparkles, group: "money" },

  // Food & drink
  { id: "utensils", glyph: Utensils, group: "food" },
  { id: "cart", glyph: ShoppingCart, group: "food" },
  { id: "coffee", glyph: Coffee, group: "food" },
  { id: "pizza", glyph: Pizza, group: "food" },
  { id: "salad", glyph: Salad, group: "food" },
  { id: "apple", glyph: Apple, group: "food" },
  { id: "cake", glyph: Cake, group: "food" },
  { id: "ice-cream", glyph: IceCreamCone, group: "food" },
  { id: "beer", glyph: Beer, group: "food" },
  { id: "wine", glyph: Wine, group: "food" },
  { id: "martini", glyph: Martini, group: "food" },
  { id: "package", glyph: Package, group: "food" },

  // Transport
  { id: "car", glyph: Car, group: "transport" },
  { id: "taxi", glyph: CarTaxiFront, group: "transport" },
  { id: "bus", glyph: Bus, group: "transport" },
  { id: "train", glyph: TrainFront, group: "transport" },
  { id: "bike", glyph: Bike, group: "transport" },
  { id: "fuel", glyph: Fuel, group: "transport" },
  { id: "parking", glyph: ParkingCircle, group: "transport" },
  { id: "wrench", glyph: Wrench, group: "transport" },
  { id: "truck", glyph: Truck, group: "transport" },

  // Home & utilities
  { id: "house", glyph: House, group: "home" },
  { id: "plug", glyph: Plug, group: "home" },
  { id: "lightbulb", glyph: Lightbulb, group: "home" },
  { id: "droplets", glyph: Droplets, group: "home" },
  { id: "flame", glyph: Flame, group: "home" },
  { id: "wifi", glyph: Wifi, group: "home" },
  { id: "phone", glyph: Phone, group: "home" },
  { id: "key", glyph: Key, group: "home" },
  { id: "hammer", glyph: Hammer, group: "home" },
  { id: "paintbrush", glyph: Paintbrush, group: "home" },
  { id: "sofa", glyph: Sofa, group: "home" },
  { id: "bed", glyph: Bed, group: "home" },
  { id: "bath", glyph: Bath, group: "home" },
  { id: "washing-machine", glyph: WashingMachine, group: "home" },
  { id: "sprout", glyph: Sprout, group: "home" },
  { id: "flower", glyph: Flower2, group: "home" },

  // Shopping
  { id: "bag", glyph: ShoppingBag, group: "shopping" },
  { id: "shirt", glyph: Shirt, group: "shopping" },
  { id: "laptop", glyph: Laptop, group: "shopping" },
  { id: "smartphone", glyph: Smartphone, group: "shopping" },
  { id: "monitor", glyph: Monitor, group: "shopping" },
  { id: "headphones", glyph: Headphones, group: "shopping" },
  { id: "watch", glyph: Watch, group: "shopping" },
  { id: "gem", glyph: Gem, group: "shopping" },
  { id: "glasses", glyph: Glasses, group: "shopping" },
  { id: "store", glyph: Store, group: "shopping" },
  { id: "scissors", glyph: Scissors, group: "shopping" },

  // Health & fitness
  { id: "heart", glyph: Heart, group: "health" },
  { id: "heart-pulse", glyph: HeartPulse, group: "health" },
  { id: "stethoscope", glyph: Stethoscope, group: "health" },
  { id: "hospital", glyph: Hospital, group: "health" },
  { id: "pill", glyph: Pill, group: "health" },
  { id: "dumbbell", glyph: Dumbbell, group: "health" },
  { id: "trophy", glyph: Trophy, group: "health" },

  // Leisure
  { id: "film", glyph: Film, group: "leisure" },
  { id: "tv", glyph: Tv, group: "leisure" },
  { id: "music", glyph: Music, group: "leisure" },
  { id: "guitar", glyph: Guitar, group: "leisure" },
  { id: "gamepad", glyph: Gamepad2, group: "leisure" },
  { id: "ticket", glyph: Ticket, group: "leisure" },
  { id: "party", glyph: PartyPopper, group: "leisure" },
  { id: "camera", glyph: Camera, group: "leisure" },
  { id: "palette", glyph: Palette, group: "leisure" },
  { id: "book", glyph: Book, group: "leisure" },
  { id: "star", glyph: Star, group: "leisure" },

  // Family & pets
  { id: "baby", glyph: Baby, group: "family" },
  { id: "hand-heart", glyph: HandHeart, group: "family" },
  { id: "gift", glyph: Gift, group: "family" },
  { id: "dog", glyph: Dog, group: "family" },
  { id: "cat", glyph: Cat, group: "family" },
  { id: "paw", glyph: PawPrint, group: "family" },
  { id: "church", glyph: Church, group: "family" },

  // Work & education
  { id: "graduation-cap", glyph: GraduationCap, group: "work" },
  { id: "school", glyph: School, group: "work" },
  { id: "book-open", glyph: BookOpen, group: "work" },
  { id: "pencil", glyph: Pencil, group: "work" },
  { id: "backpack", glyph: Backpack, group: "work" },
  { id: "building", glyph: Building2, group: "work" },
  { id: "calculator", glyph: Calculator, group: "work" },
  { id: "file", glyph: FileText, group: "work" },
  { id: "mail", glyph: Mail, group: "work" },

  // Travel
  { id: "plane", glyph: Plane, group: "travel" },
  { id: "hotel", glyph: Hotel, group: "travel" },
  { id: "luggage", glyph: Luggage, group: "travel" },
  { id: "map-pin", glyph: MapPin, group: "travel" },
  { id: "globe", glyph: Globe, group: "travel" },
  { id: "tent", glyph: Tent, group: "travel" },
  { id: "ship", glyph: Ship, group: "travel" },
  { id: "anchor", glyph: Anchor, group: "travel" },
  { id: "umbrella", glyph: Umbrella, group: "travel" },

  // Fees & finance
  { id: "receipt", glyph: Receipt, group: "finance" },
  { id: "credit-card", glyph: CreditCard, group: "finance" },
  { id: "shield", glyph: Shield, group: "finance" },
  { id: "landmark", glyph: Landmark, group: "finance" },
  { id: "percent", glyph: Percent, group: "finance" },
] as const satisfies readonly {
  readonly id: CategoryIconId;
  readonly glyph: React.ComponentType<LucideProps>;
  readonly group: IconGroupId;
}[];

type Definition = (typeof DEFINITIONS)[number];

export type IconId = Definition["id"];

/** The catalog in browse order; every id appears exactly once. */
export const ICON_CATALOG: readonly IconDefinition[] = DEFINITIONS;

const BY_ID: ReadonlyMap<string, IconDefinition> = new Map(
  DEFINITIONS.map((definition) => [definition.id, definition]),
);

const GENERIC = BY_ID.get(GENERIC_ICON_ID satisfies IconId);
if (!GENERIC) {
  throw new Error("The icon catalog must define the generic icon");
}
/** Always defined, so a fallback never depends on catalog order. */
export const GENERIC_ICON: IconDefinition = GENERIC;

export function isIconId(value: string): value is IconId {
  return isCategoryIconId(value) && BY_ID.has(value);
}

/** Resolves a stored id to its definition, falling back to the generic icon. */
export function iconDefinition(id: string): IconDefinition {
  return BY_ID.get(id) ?? GENERIC_ICON;
}

/** Resolves a stored id to a glyph, falling back to the generic icon. */
export function iconById(id: string): React.ComponentType<LucideProps> {
  return iconDefinition(id).glyph;
}

export function iconsInGroup(group: IconGroupId): readonly IconDefinition[] {
  return DEFINITIONS.filter((definition) => definition.group === group);
}
