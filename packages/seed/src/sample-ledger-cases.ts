import type { WalletType } from "@bookkeeping/domain/wallets";

// The sample ledger, as data. Each case carries a one-line comment naming what
// it exercises, so nobody deletes it as noise. A ticket that needs a new edge
// case adds it here.

/** Baht to satang, the integer unit every amount is stored in. */
function baht(amount: number): bigint {
  return BigInt(Math.round(amount * 100));
}

/** How long before the run day every Wallet opens; transactions stay inside it. */
export const openedDaysAgo = 125;

interface WalletCase {
  key: string;
  name: string;
  type: WalletType;
  savings: boolean;
  opening: bigint;
  /** Archived after its transactions are in. */
  archived?: boolean;
}

export const walletCases = [
  // A plain cash Wallet with a small balance.
  {
    key: "cash",
    name: "Cash",
    type: "cash",
    savings: false,
    opening: baht(3500),
  },
  // The everyday bank account most transactions touch.
  {
    key: "everyday",
    name: "Everyday account",
    type: "bank_account",
    savings: false,
    opening: baht(48_250.75),
  },
  // A long name, to see how Wallet names truncate or wrap.
  {
    key: "household",
    name: "Joint household and utility bills account",
    type: "bank_account",
    savings: false,
    opening: baht(12_400),
  },
  // A seven-digit balance, to see whether money amounts fit their columns.
  {
    key: "property",
    name: "Property sale proceeds",
    type: "bank_account",
    savings: false,
    opening: baht(2_450_000),
  },
  // An e-wallet with a small balance.
  {
    key: "ewallet",
    name: "TrueMoney",
    type: "e_wallet",
    savings: false,
    opening: baht(850),
  },
  // A Savings wallet, so Set aside is non-zero beside Spendable.
  {
    key: "savings",
    name: "Emergency fund",
    type: "bank_account",
    savings: true,
    opening: baht(180_000),
  },
  // An archived Wallet that still holds history.
  {
    key: "closed",
    name: "Old Kasikorn account",
    type: "bank_account",
    savings: false,
    opening: baht(20_000),
    archived: true,
  },
] as const satisfies readonly WalletCase[];

export type WalletKey = (typeof walletCases)[number]["key"];

interface CategoryCase {
  kind: "income" | "expense";
  parent: string;
  child: string;
  iconId: string;
}

// Long Parent category › Child category names, to see how category labels
// behave; the default categories cover the short ones.
export const categoryCases: readonly CategoryCase[] = [
  {
    kind: "expense",
    parent: "Home improvement and long-term maintenance",
    child: "Seasonal garden and outdoor furniture upkeep",
    iconId: "wrench",
  },
  {
    kind: "income",
    parent: "Investment and passive income streams",
    child: "Quarterly dividend distributions from index funds",
    iconId: "trending",
  },
];

// About 16 Tags: ten short ones and six long ones, to see tag pills wrap.
export const tagNames: readonly string[] = [
  "groceries",
  "coffee",
  "work",
  "weekend",
  "family",
  "commute",
  "online",
  "gift",
  "health",
  "subscription",
  "reimbursable by employer next month",
  "shared with housemates, split evenly",
  "annual renewal reminder due soon",
  "bought during the 11.11 mega sale",
  "tax deductible, keep the receipt",
  "family trip to Chiang Mai",
];

interface TransactionCase {
  daysAgo: number;
  type: "income" | "expense" | "transfer" | "refund";
  wallet: WalletKey;
  /** The receiving Wallet of a transfer. */
  to?: WalletKey;
  /** A label such as "Food & Drink › Groceries"; absent for transfers and refunds. */
  category?: string;
  amount: bigint;
  tags?: readonly string[];
  note?: string;
  /** Names an expense so a later refund can return money for it. */
  expenseKey?: string;
  /** The `expenseKey` of the expense this refund returns money for. */
  refundOf?: string;
}

const monthlyDaysAgo = [1, 31, 61, 91] as const;

const monthlyCases: readonly TransactionCase[] = monthlyDaysAgo.flatMap(
  (daysAgo) => [
    // Income every month, so each Report month has an income side.
    {
      daysAgo,
      type: "income",
      wallet: "everyday",
      category: "Salary",
      amount: baht(55_000),
      note: "Monthly salary",
    },
    // A recurring expense with a Note and no Tags.
    {
      daysAgo: daysAgo + 4,
      type: "expense",
      wallet: "everyday",
      category: "Housing › Rent",
      amount: baht(14_500),
      note: "Rent for the month",
    },
    // A recurring transfer into the Savings wallet.
    {
      daysAgo: daysAgo + 2,
      type: "transfer",
      wallet: "everyday",
      to: "savings",
      amount: baht(10_000),
      note: "Monthly saving",
    },
  ],
);

export const transactionCases: readonly TransactionCase[] = [
  ...monthlyCases,
  // Today, so the current month on Home and Reports is never empty.
  {
    daysAgo: 0,
    type: "expense",
    wallet: "ewallet",
    category: "Food & Drink › Coffee & snacks",
    amount: baht(95),
    tags: ["coffee"],
  },
  // Income dated today, for the same reason.
  {
    daysAgo: 0,
    type: "income",
    wallet: "everyday",
    category: "Freelance",
    amount: baht(7800),
    tags: ["work"],
    note: "Logo design for a client",
  },
  // A transaction with no Tags and no Note, the plainest row.
  {
    daysAgo: 3,
    type: "expense",
    wallet: "cash",
    category: "Transport › Public transit",
    amount: baht(45),
  },
  // The most Tags one transaction may carry, with a long Note.
  {
    daysAgo: 9,
    type: "expense",
    wallet: "everyday",
    category: "Travel",
    amount: baht(18_640),
    tags: [
      "family trip to Chiang Mai",
      "family",
      "weekend",
      "online",
      "reimbursable by employer next month",
    ],
    note: "Flights and the first two nights of the hotel for the long weekend with the whole family, booked early so the refundable fare could be kept.",
  },
  // A cash withdrawal: a transfer with no Note.
  {
    daysAgo: 12,
    type: "transfer",
    wallet: "everyday",
    to: "cash",
    amount: baht(2000),
  },
  // An expense in the long-named Wallet, with Tags.
  {
    daysAgo: 14,
    type: "expense",
    wallet: "household",
    category: "Housing › Utilities",
    amount: baht(2380.5),
    tags: ["subscription", "annual renewal reminder due soon"],
  },
  // A transaction under a long Parent › Child category, in the seven-digit Wallet.
  {
    daysAgo: 18,
    type: "expense",
    wallet: "property",
    category:
      "Home improvement and long-term maintenance › Seasonal garden and outdoor furniture upkeep",
    amount: baht(45_000),
    tags: ["tax deductible, keep the receipt"],
    note: "Landscaper's deposit",
  },
  // Income under a long Parent › Child category, into the Savings wallet.
  {
    daysAgo: 20,
    type: "income",
    wallet: "savings",
    category:
      "Investment and passive income streams › Quarterly dividend distributions from index funds",
    amount: baht(3125.5),
  },
  // Spending that is filed under Uncategorized.
  {
    daysAgo: 23,
    type: "expense",
    wallet: "cash",
    category: "Uncategorized",
    amount: baht(120),
    note: "Market stall, no receipt",
  },
  // Groceries with two Tags.
  {
    daysAgo: 26,
    type: "expense",
    wallet: "everyday",
    category: "Food & Drink › Groceries",
    amount: baht(1865.25),
    tags: ["groceries", "shared with housemates, split evenly"],
  },
  // An e-wallet top-up transfer with no Note.
  {
    daysAgo: 28,
    type: "transfer",
    wallet: "everyday",
    to: "ewallet",
    amount: baht(500),
  },
  // An expense that a Refund below returns money for.
  {
    daysAgo: 40,
    type: "expense",
    wallet: "everyday",
    category: "Shopping › Electronics",
    amount: baht(3290),
    tags: ["online", "bought during the 11.11 mega sale"],
    note: "Wireless earbuds",
    expenseKey: "earbuds",
  },
  // A Refund, returning part of the expense above.
  {
    daysAgo: 33,
    type: "refund",
    wallet: "everyday",
    amount: baht(1000),
    note: "Partial refund for a faulty charging case",
    refundOf: "earbuds",
  },
  // Moving money out of the property Wallet, which stays seven digits.
  {
    daysAgo: 48,
    type: "transfer",
    wallet: "property",
    to: "everyday",
    amount: baht(100_000),
    note: "Funds for the renovation",
  },
  // Entertainment with a Tag and no Note.
  {
    daysAgo: 55,
    type: "expense",
    wallet: "everyday",
    category: "Entertainment › Streaming",
    amount: baht(419),
    tags: ["subscription"],
  },
  // A gift, with Tags and a Note.
  {
    daysAgo: 70,
    type: "expense",
    wallet: "everyday",
    category: "Gifts & donations",
    amount: baht(1200),
    tags: ["gift", "family"],
    note: "Birthday present",
  },
  // History inside the archived Wallet: spending, then a closing transfer.
  {
    daysAgo: 118,
    type: "expense",
    wallet: "closed",
    category: "Food & Drink › Groceries",
    amount: baht(850),
    tags: ["groceries"],
  },
  {
    daysAgo: 100,
    type: "expense",
    wallet: "closed",
    category: "Transport › Fuel",
    amount: baht(1200),
    tags: ["commute"],
    note: "Full tank before the trip",
  },
  {
    daysAgo: 95,
    type: "transfer",
    wallet: "closed",
    to: "everyday",
    amount: baht(5000),
    note: "Closing the old account",
  },
  // A health expense with a Tag.
  {
    daysAgo: 80,
    type: "expense",
    wallet: "household",
    category: "Health › Pharmacy",
    amount: baht(640),
    tags: ["health"],
  },
];
