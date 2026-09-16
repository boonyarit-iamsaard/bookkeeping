import { GENERIC_ICON_ID } from "@bookkeeping/domain/categories";
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
  readonly id: string;
  readonly glyph: React.ComponentType<LucideProps>;
  readonly group: IconGroupId;
  /**
   * Lowercase English words or phrases a person might type for this icon. A
   * phrase matches a whole query; single words match query tokens.
   */
  readonly tags: readonly string[];
}

interface DefineIconOptions<Id extends string> {
  id: Id;
  glyph: React.ComponentType<LucideProps>;
  group: IconGroupId;
  tags: readonly string[];
}

function defineIcon<const Id extends string>({
  id,
  glyph,
  group,
  tags,
}: Readonly<DefineIconOptions<Id>>) {
  return { id, glyph, group, tags } as const;
}

/**
 * The stable icon catalog. Ids are permanent references persisted on
 * categories; the Lucide glyph behind an id may change, the id never does.
 * Unknown or retired ids render the generic icon without being rewritten.
 * Catalog order is the deterministic tie-break for recommendations.
 */
const DEFINITIONS = [
  defineIcon({
    id: "generic",
    glyph: Tag,
    group: "general",
    tags: ["general", "other", "misc", "tag"],
  }),

  // Money & income
  defineIcon({
    id: "banknote",
    glyph: Banknote,
    group: "money",
    tags: ["cash", "money", "banknote", "other income"],
  }),
  defineIcon({
    id: "briefcase",
    glyph: BriefcaseBusiness,
    group: "money",
    tags: ["salary", "wages", "pay", "paycheck", "job", "work", "business"],
  }),
  defineIcon({
    id: "coins",
    glyph: Coins,
    group: "money",
    tags: ["coins", "change", "allowance", "pocket money"],
  }),
  defineIcon({
    id: "hand-coins",
    glyph: HandCoins,
    group: "money",
    tags: ["sale", "sold", "resale", "proceeds", "earnings", "commission"],
  }),
  defineIcon({
    id: "trending",
    glyph: TrendingUp,
    group: "money",
    tags: [
      "investment",
      "dividend",
      "stocks",
      "fund",
      "return",
      "growth",
      "capital gain",
    ],
  }),
  defineIcon({
    id: "piggy-bank",
    glyph: PiggyBank,
    group: "money",
    tags: ["savings", "saving", "deposit", "emergency fund"],
  }),
  defineIcon({
    id: "wallet",
    glyph: Wallet,
    group: "money",
    tags: ["wallet", "petty cash", "spending money"],
  }),
  defineIcon({
    id: "dollar",
    glyph: CircleDollarSign,
    group: "money",
    tags: [
      "income",
      "revenue",
      "profit",
      "refund",
      "reimbursement",
      "cashback",
    ],
  }),
  defineIcon({
    id: "bitcoin",
    glyph: Bitcoin,
    group: "money",
    tags: ["crypto", "bitcoin", "cryptocurrency"],
  }),
  defineIcon({
    id: "sparkles",
    glyph: Sparkles,
    group: "money",
    tags: ["bonus", "reward", "prize", "windfall", "lottery", "tip"],
  }),

  // Food & drink
  defineIcon({
    id: "utensils",
    glyph: Utensils,
    group: "food",
    tags: [
      "food",
      "restaurant",
      "meal",
      "dining",
      "eating out",
      "lunch",
      "dinner",
      "breakfast",
    ],
  }),
  defineIcon({
    id: "cart",
    glyph: ShoppingCart,
    group: "food",
    tags: ["grocery", "groceries", "supermarket", "market", "provisions"],
  }),
  defineIcon({
    id: "coffee",
    glyph: Coffee,
    group: "food",
    tags: [
      "coffee",
      "cafe",
      "tea",
      "snack",
      "snacks",
      "bubble tea",
      "milk tea",
    ],
  }),
  defineIcon({
    id: "pizza",
    glyph: Pizza,
    group: "food",
    tags: ["pizza", "fast food", "takeaway", "takeout", "junk food"],
  }),
  defineIcon({
    id: "salad",
    glyph: Salad,
    group: "food",
    tags: ["salad", "healthy food", "vegetable", "vegetables", "diet"],
  }),
  defineIcon({
    id: "apple",
    glyph: Apple,
    group: "food",
    tags: ["fruit", "apple", "produce"],
  }),
  defineIcon({
    id: "cake",
    glyph: Cake,
    group: "food",
    tags: ["cake", "dessert", "bakery", "birthday", "sweets"],
  }),
  defineIcon({
    id: "ice-cream",
    glyph: IceCreamCone,
    group: "food",
    tags: ["ice cream", "gelato", "treat", "treats"],
  }),
  defineIcon({
    id: "beer",
    glyph: Beer,
    group: "food",
    tags: ["beer", "alcohol", "bar", "pub", "drink", "drinks", "nightlife"],
  }),
  defineIcon({
    id: "wine",
    glyph: Wine,
    group: "food",
    tags: ["wine", "liquor", "spirits"],
  }),
  defineIcon({
    id: "martini",
    glyph: Martini,
    group: "food",
    tags: ["cocktail", "cocktails", "party drinks"],
  }),
  defineIcon({
    id: "package",
    glyph: Package,
    group: "food",
    tags: [
      "delivery",
      "parcel",
      "package",
      "shipping",
      "order",
      "online order",
    ],
  }),

  // Transport
  defineIcon({
    id: "car",
    glyph: Car,
    group: "transport",
    tags: [
      "car",
      "auto",
      "vehicle",
      "transport",
      "driving",
      "car wash",
      "car payment",
    ],
  }),
  defineIcon({
    id: "taxi",
    glyph: CarTaxiFront,
    group: "transport",
    tags: ["taxi", "ride", "ride hailing", "grab", "uber", "cab"],
  }),
  defineIcon({
    id: "bus",
    glyph: Bus,
    group: "transport",
    tags: [
      "bus",
      "public transit",
      "transit",
      "transport",
      "commute",
      "shuttle",
    ],
  }),
  defineIcon({
    id: "train",
    glyph: TrainFront,
    group: "transport",
    tags: [
      "train",
      "rail",
      "railway",
      "subway",
      "metro",
      "bts",
      "mrt",
      "skytrain",
    ],
  }),
  defineIcon({
    id: "bike",
    glyph: Bike,
    group: "transport",
    tags: ["bike", "bicycle", "cycling", "motorbike", "motorcycle", "scooter"],
  }),
  defineIcon({
    id: "fuel",
    glyph: Fuel,
    group: "transport",
    tags: ["fuel", "petrol", "gas", "gasoline", "diesel", "charging"],
  }),
  defineIcon({
    id: "parking",
    glyph: ParkingCircle,
    group: "transport",
    tags: ["parking", "toll", "tolls", "expressway"],
  }),
  defineIcon({
    id: "wrench",
    glyph: Wrench,
    group: "transport",
    tags: ["repair", "repairs", "maintenance", "service", "mechanic", "fix"],
  }),
  defineIcon({
    id: "truck",
    glyph: Truck,
    group: "transport",
    tags: ["truck", "moving", "freight", "haulage", "removal"],
  }),

  // Home & utilities
  defineIcon({
    id: "house",
    glyph: House,
    group: "home",
    tags: [
      "home",
      "house",
      "rent",
      "mortgage",
      "housing",
      "condo",
      "apartment",
      "accommodation",
    ],
  }),
  defineIcon({
    id: "plug",
    glyph: Plug,
    group: "home",
    tags: [
      "utilities",
      "utility",
      "electricity",
      "electric",
      "power",
      "energy",
    ],
  }),
  defineIcon({
    id: "lightbulb",
    glyph: Lightbulb,
    group: "home",
    tags: ["light", "lighting", "bulb", "idea"],
  }),
  defineIcon({
    id: "droplets",
    glyph: Droplets,
    group: "home",
    tags: ["water", "water bill", "plumbing"],
  }),
  defineIcon({
    id: "flame",
    glyph: Flame,
    group: "home",
    tags: ["gas", "cooking gas", "heating", "fire"],
  }),
  defineIcon({
    id: "wifi",
    glyph: Wifi,
    group: "home",
    tags: [
      "internet",
      "wifi",
      "broadband",
      "phone bill",
      "mobile plan",
      "data",
    ],
  }),
  defineIcon({
    id: "phone",
    glyph: Phone,
    group: "home",
    tags: ["phone", "telephone", "mobile", "call", "calls"],
  }),
  defineIcon({
    id: "key",
    glyph: Key,
    group: "home",
    tags: ["key", "keys", "deposit", "locksmith", "security"],
  }),
  defineIcon({
    id: "hammer",
    glyph: Hammer,
    group: "home",
    tags: [
      "renovation",
      "diy",
      "tools",
      "hardware",
      "construction",
      "handyman",
    ],
  }),
  defineIcon({
    id: "paintbrush",
    glyph: Paintbrush,
    group: "home",
    tags: ["paint", "painting", "decor", "decoration", "decorating"],
  }),
  defineIcon({
    id: "sofa",
    glyph: Sofa,
    group: "home",
    tags: [
      "furniture",
      "sofa",
      "household",
      "home goods",
      "appliance",
      "appliances",
    ],
  }),
  defineIcon({
    id: "bed",
    glyph: Bed,
    group: "home",
    tags: ["bed", "bedding", "mattress", "sleep"],
  }),
  defineIcon({
    id: "bath",
    glyph: Bath,
    group: "home",
    tags: ["bathroom", "bath", "toiletries", "cleaning", "cleaning supplies"],
  }),
  defineIcon({
    id: "washing-machine",
    glyph: WashingMachine,
    group: "home",
    tags: ["laundry", "washing", "dry cleaning", "ironing"],
  }),
  defineIcon({
    id: "sprout",
    glyph: Sprout,
    group: "home",
    tags: ["garden", "gardening", "plant", "plants", "lawn"],
  }),
  defineIcon({
    id: "flower",
    glyph: Flower2,
    group: "home",
    tags: ["flower", "flowers", "florist", "bouquet"],
  }),

  // Shopping
  defineIcon({
    id: "bag",
    glyph: ShoppingBag,
    group: "shopping",
    tags: ["shopping", "shop", "purchase", "purchases", "retail", "mall"],
  }),
  defineIcon({
    id: "shirt",
    glyph: Shirt,
    group: "shopping",
    tags: [
      "clothing",
      "clothes",
      "fashion",
      "apparel",
      "shirt",
      "wardrobe",
      "shoes",
    ],
  }),
  defineIcon({
    id: "laptop",
    glyph: Laptop,
    group: "shopping",
    tags: [
      "electronics",
      "laptop",
      "computer",
      "gadget",
      "gadgets",
      "freelance",
      "tech",
    ],
  }),
  defineIcon({
    id: "smartphone",
    glyph: Smartphone,
    group: "shopping",
    tags: ["smartphone", "phone", "device", "app", "apps", "mobile phone"],
  }),
  defineIcon({
    id: "monitor",
    glyph: Monitor,
    group: "shopping",
    tags: ["monitor", "screen", "desktop", "pc"],
  }),
  defineIcon({
    id: "headphones",
    glyph: Headphones,
    group: "shopping",
    tags: ["headphones", "audio", "earbuds", "speaker"],
  }),
  defineIcon({
    id: "watch",
    glyph: Watch,
    group: "shopping",
    tags: ["watch", "watches", "accessories", "accessory"],
  }),
  defineIcon({
    id: "gem",
    glyph: Gem,
    group: "shopping",
    tags: ["jewelry", "jewellery", "gold", "gem", "luxury", "diamond", "ring"],
  }),
  defineIcon({
    id: "glasses",
    glyph: Glasses,
    group: "shopping",
    tags: ["glasses", "eyewear", "optician", "contact lenses", "eyes"],
  }),
  defineIcon({
    id: "store",
    glyph: Store,
    group: "shopping",
    tags: ["store", "convenience store", "7-eleven", "seven eleven", "kiosk"],
  }),
  defineIcon({
    id: "scissors",
    glyph: Scissors,
    group: "shopping",
    tags: [
      "personal care",
      "haircut",
      "hair",
      "salon",
      "barber",
      "grooming",
      "beauty",
      "nails",
      "spa",
      "massage",
    ],
  }),

  // Health & fitness
  defineIcon({
    id: "heart",
    glyph: Heart,
    group: "health",
    tags: ["health", "medical", "wellness", "care", "love", "date", "dating"],
  }),
  defineIcon({
    id: "heart-pulse",
    glyph: HeartPulse,
    group: "health",
    tags: ["checkup", "check up", "cardio", "vitals", "clinic"],
  }),
  defineIcon({
    id: "stethoscope",
    glyph: Stethoscope,
    group: "health",
    tags: ["doctor", "physician", "consultation", "gp", "dentist", "dental"],
  }),
  defineIcon({
    id: "hospital",
    glyph: Hospital,
    group: "health",
    tags: ["hospital", "emergency", "surgery", "treatment"],
  }),
  defineIcon({
    id: "pill",
    glyph: Pill,
    group: "health",
    tags: [
      "pharmacy",
      "medicine",
      "medication",
      "drugs",
      "prescription",
      "vitamins",
      "supplements",
    ],
  }),
  defineIcon({
    id: "dumbbell",
    glyph: Dumbbell,
    group: "health",
    tags: [
      "fitness",
      "gym",
      "workout",
      "exercise",
      "sport",
      "sports",
      "training",
      "yoga",
    ],
  }),
  defineIcon({
    id: "trophy",
    glyph: Trophy,
    group: "health",
    tags: [
      "competition",
      "tournament",
      "race",
      "marathon",
      "award",
      "achievement",
    ],
  }),

  // Leisure
  defineIcon({
    id: "film",
    glyph: Film,
    group: "leisure",
    tags: [
      "entertainment",
      "movie",
      "movies",
      "cinema",
      "film",
      "theater",
      "theatre",
      "show",
    ],
  }),
  defineIcon({
    id: "tv",
    glyph: Tv,
    group: "leisure",
    tags: [
      "tv",
      "television",
      "streaming",
      "netflix",
      "subscription",
      "subscriptions",
      "cable",
    ],
  }),
  defineIcon({
    id: "music",
    glyph: Music,
    group: "leisure",
    tags: ["music", "spotify", "concert", "concerts", "song", "songs", "album"],
  }),
  defineIcon({
    id: "guitar",
    glyph: Guitar,
    group: "leisure",
    tags: ["guitar", "instrument", "instruments", "band", "lesson", "lessons"],
  }),
  defineIcon({
    id: "gamepad",
    glyph: Gamepad2,
    group: "leisure",
    tags: [
      "game",
      "games",
      "gaming",
      "hobby",
      "hobbies",
      "console",
      "playstation",
      "steam",
    ],
  }),
  defineIcon({
    id: "ticket",
    glyph: Ticket,
    group: "leisure",
    tags: [
      "ticket",
      "tickets",
      "event",
      "events",
      "admission",
      "festival",
      "exhibition",
    ],
  }),
  defineIcon({
    id: "party",
    glyph: PartyPopper,
    group: "leisure",
    tags: ["party", "celebration", "wedding", "anniversary", "night out"],
  }),
  defineIcon({
    id: "camera",
    glyph: Camera,
    group: "leisure",
    tags: ["camera", "photo", "photos", "photography", "video"],
  }),
  defineIcon({
    id: "palette",
    glyph: Palette,
    group: "leisure",
    tags: ["art", "craft", "crafts", "creative", "supplies", "drawing"],
  }),
  defineIcon({
    id: "book",
    glyph: Book,
    group: "leisure",
    tags: [
      "book",
      "books",
      "reading",
      "novel",
      "magazine",
      "magazines",
      "comics",
      "library",
    ],
  }),
  defineIcon({
    id: "star",
    glyph: Star,
    group: "leisure",
    tags: ["favorite", "favourite", "star", "special", "fun", "leisure"],
  }),

  // Family & pets
  defineIcon({
    id: "baby",
    glyph: Baby,
    group: "family",
    tags: [
      "baby",
      "family",
      "kids",
      "children",
      "child",
      "childcare",
      "nursery",
      "daycare",
      "diapers",
    ],
  }),
  defineIcon({
    id: "hand-heart",
    glyph: HandHeart,
    group: "family",
    tags: [
      "donation",
      "donations",
      "charity",
      "giving",
      "support",
      "parents",
      "allowance to parents",
      "merit",
    ],
  }),
  defineIcon({
    id: "gift",
    glyph: Gift,
    group: "family",
    tags: [
      "gift",
      "gifts",
      "present",
      "presents",
      "donation",
      "gifts received",
      "red envelope",
    ],
  }),
  defineIcon({
    id: "dog",
    glyph: Dog,
    group: "family",
    tags: ["dog", "puppy", "pet", "pets", "vet", "dog food"],
  }),
  defineIcon({
    id: "cat",
    glyph: Cat,
    group: "family",
    tags: ["cat", "kitten", "cat food"],
  }),
  defineIcon({
    id: "paw",
    glyph: PawPrint,
    group: "family",
    tags: ["pet food", "pet care", "grooming", "animal", "animals"],
  }),
  defineIcon({
    id: "church",
    glyph: Church,
    group: "family",
    tags: [
      "temple",
      "church",
      "religion",
      "religious",
      "offering",
      "merit making",
      "mosque",
    ],
  }),

  // Work & education
  defineIcon({
    id: "graduation-cap",
    glyph: GraduationCap,
    group: "work",
    tags: [
      "education",
      "school",
      "tuition",
      "course",
      "courses",
      "university",
      "college",
      "degree",
      "study",
    ],
  }),
  defineIcon({
    id: "school",
    glyph: School,
    group: "work",
    tags: ["school fees", "kindergarten", "campus", "classroom"],
  }),
  defineIcon({
    id: "book-open",
    glyph: BookOpen,
    group: "work",
    tags: [
      "textbook",
      "textbooks",
      "stationery",
      "class",
      "classes",
      "learning",
    ],
  }),
  defineIcon({
    id: "pencil",
    glyph: Pencil,
    group: "work",
    tags: [
      "pencil",
      "pen",
      "writing",
      "stationery",
      "office supplies",
      "supplies",
    ],
  }),
  defineIcon({
    id: "backpack",
    glyph: Backpack,
    group: "work",
    tags: ["backpack", "school bag", "uniform", "school supplies"],
  }),
  defineIcon({
    id: "building",
    glyph: Building2,
    group: "work",
    tags: [
      "office",
      "company",
      "employer",
      "corporate",
      "coworking",
      "workplace",
    ],
  }),
  defineIcon({
    id: "calculator",
    glyph: Calculator,
    group: "work",
    tags: ["accounting", "accountant", "bookkeeping", "calculator", "audit"],
  }),
  defineIcon({
    id: "file",
    glyph: FileText,
    group: "work",
    tags: [
      "document",
      "documents",
      "paperwork",
      "contract",
      "printing",
      "copies",
      "legal",
    ],
  }),
  defineIcon({
    id: "mail",
    glyph: Mail,
    group: "work",
    tags: ["mail", "post", "postage", "stamps", "letter", "courier"],
  }),

  // Travel
  defineIcon({
    id: "plane",
    glyph: Plane,
    group: "travel",
    tags: [
      "travel",
      "flight",
      "flights",
      "airfare",
      "airline",
      "trip",
      "vacation",
      "holiday",
      "abroad",
    ],
  }),
  defineIcon({
    id: "hotel",
    glyph: Hotel,
    group: "travel",
    tags: ["hotel", "hostel", "lodging", "airbnb", "resort", "stay"],
  }),
  defineIcon({
    id: "luggage",
    glyph: Luggage,
    group: "travel",
    tags: ["luggage", "suitcase", "baggage", "packing", "travel gear"],
  }),
  defineIcon({
    id: "map-pin",
    glyph: MapPin,
    group: "travel",
    tags: [
      "destination",
      "location",
      "tour",
      "tours",
      "sightseeing",
      "excursion",
      "day trip",
    ],
  }),
  defineIcon({
    id: "globe",
    glyph: Globe,
    group: "travel",
    tags: ["international", "overseas", "foreign", "visa", "passport", "world"],
  }),
  defineIcon({
    id: "tent",
    glyph: Tent,
    group: "travel",
    tags: ["camping", "outdoor", "outdoors", "hiking", "nature", "trekking"],
  }),
  defineIcon({
    id: "ship",
    glyph: Ship,
    group: "travel",
    tags: ["ferry", "boat", "cruise", "ship", "sailing"],
  }),
  defineIcon({
    id: "anchor",
    glyph: Anchor,
    group: "travel",
    tags: ["harbor", "harbour", "marina", "port", "dock"],
  }),
  defineIcon({
    id: "umbrella",
    glyph: Umbrella,
    group: "travel",
    tags: ["beach", "rain", "weather", "umbrella", "seaside"],
  }),

  // Fees & finance
  defineIcon({
    id: "receipt",
    glyph: Receipt,
    group: "finance",
    tags: [
      "fee",
      "fees",
      "charge",
      "charges",
      "bill",
      "bills",
      "receipt",
      "bank fee",
      "service charge",
    ],
  }),
  defineIcon({
    id: "credit-card",
    glyph: CreditCard,
    group: "finance",
    tags: [
      "credit card",
      "card",
      "card payment",
      "debit card",
      "installment",
      "instalment",
      "minimum payment",
    ],
  }),
  defineIcon({
    id: "shield",
    glyph: Shield,
    group: "finance",
    tags: [
      "insurance",
      "protection",
      "cover",
      "coverage",
      "policy",
      "premium",
      "car insurance",
      "health insurance",
      "life insurance",
      "warranty",
    ],
  }),
  defineIcon({
    id: "landmark",
    glyph: Landmark,
    group: "finance",
    tags: [
      "tax",
      "taxes",
      "government",
      "bank",
      "banking",
      "fine",
      "fines",
      "duty",
      "levy",
    ],
  }),
  defineIcon({
    id: "percent",
    glyph: Percent,
    group: "finance",
    tags: [
      "interest",
      "rate",
      "loan",
      "loan payment",
      "debt",
      "installment interest",
      "discount",
    ],
  }),
] as const;

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
  return BY_ID.has(value);
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
