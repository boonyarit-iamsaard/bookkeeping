import type { LucideProps } from "lucide-react";
import {
  Baby,
  Banknote,
  BriefcaseBusiness,
  Bus,
  Car,
  Coffee,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  Heart,
  House,
  Landmark,
  Laptop,
  Package,
  ParkingCircle,
  PartyPopper,
  Percent,
  Pill,
  Plane,
  Plug,
  Receipt,
  Scissors,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sofa,
  Sparkles,
  Tag,
  TrendingUp,
  Tv,
  Utensils,
  Wifi,
  Wrench,
} from "lucide-react";

/**
 * The stable icon catalog. Ids are permanent references persisted on
 * categories; the Lucide glyph behind an id may change, the id never does.
 * Unknown or retired ids render the generic icon without being rewritten.
 */
const CATALOG = {
  generic: Tag,
  banknote: Banknote,
  briefcase: BriefcaseBusiness,
  trending: TrendingUp,
  "hand-coins": HandCoins,
  gift: Gift,
  package: Package,
  utensils: Utensils,
  cart: ShoppingCart,
  coffee: Coffee,
  car: Car,
  bus: Bus,
  fuel: Fuel,
  parking: ParkingCircle,
  house: House,
  plug: Plug,
  wifi: Wifi,
  wrench: Wrench,
  bag: ShoppingBag,
  shirt: Shirt,
  laptop: Laptop,
  sofa: Sofa,
  heart: Heart,
  pill: Pill,
  dumbbell: Dumbbell,
  film: Film,
  tv: Tv,
  party: PartyPopper,
  gamepad: Gamepad2,
  scissors: Scissors,
  "graduation-cap": GraduationCap,
  baby: Baby,
  plane: Plane,
  receipt: Receipt,
  shield: Shield,
  landmark: Landmark,
  percent: Percent,
  sparkles: Sparkles,
} satisfies Record<string, React.ComponentType<LucideProps>>;

export type IconId = keyof typeof CATALOG;

export const GENERIC_ICON_ID: IconId = "generic";

export function isIconId(value: string): value is IconId {
  return Object.hasOwn(CATALOG, value);
}

/** Resolves a stored id to a glyph, falling back to the generic icon. */
export function iconById(id: string): React.ComponentType<LucideProps> {
  return isIconId(id) ? CATALOG[id] : CATALOG[GENERIC_ICON_ID];
}
