import type { CategoryKind } from "@bookkeeping/domain/categories";

export interface DefaultCategory {
  name: string;
  /** A catalog id; the web icon catalog test keeps it valid. */
  iconId: string;
  children?: readonly { name: string; iconId: string }[];
}

/**
 * Seed trees copied into each user's editable categories once. Confirmed with
 * the user on 2026-09-13. Uncategorized is added by the initializer, not here.
 */
export const DEFAULT_CATEGORIES: Record<
  CategoryKind,
  readonly DefaultCategory[]
> = {
  expense: [
    {
      name: "Food & Drink",
      iconId: "utensils",
      children: [
        { name: "Groceries", iconId: "cart" },
        { name: "Restaurants", iconId: "utensils" },
        { name: "Coffee & snacks", iconId: "coffee" },
        { name: "Delivery", iconId: "package" },
      ],
    },
    {
      name: "Transport",
      iconId: "car",
      children: [
        { name: "Fuel", iconId: "fuel" },
        { name: "Public transit", iconId: "bus" },
        { name: "Taxi & ride-hailing", iconId: "car" },
        { name: "Parking & tolls", iconId: "parking" },
      ],
    },
    {
      name: "Housing",
      iconId: "house",
      children: [
        { name: "Rent", iconId: "house" },
        { name: "Utilities", iconId: "plug" },
        { name: "Internet & phone", iconId: "wifi" },
        { name: "Maintenance", iconId: "wrench" },
      ],
    },
    {
      name: "Shopping",
      iconId: "bag",
      children: [
        { name: "Clothing", iconId: "shirt" },
        { name: "Electronics", iconId: "laptop" },
        { name: "Household", iconId: "sofa" },
      ],
    },
    {
      name: "Health",
      iconId: "heart",
      children: [
        { name: "Medical", iconId: "heart" },
        { name: "Pharmacy", iconId: "pill" },
        { name: "Fitness", iconId: "dumbbell" },
      ],
    },
    {
      name: "Entertainment",
      iconId: "film",
      children: [
        { name: "Streaming", iconId: "tv" },
        { name: "Events", iconId: "party" },
        { name: "Games & hobbies", iconId: "gamepad" },
      ],
    },
    { name: "Personal care", iconId: "scissors" },
    { name: "Education", iconId: "graduation-cap" },
    { name: "Family & pets", iconId: "baby" },
    { name: "Gifts & donations", iconId: "gift" },
    { name: "Travel", iconId: "plane" },
    { name: "Fees & charges", iconId: "receipt" },
    { name: "Insurance", iconId: "shield" },
    { name: "Taxes", iconId: "landmark" },
  ],
  income: [
    { name: "Salary", iconId: "briefcase" },
    { name: "Bonus", iconId: "sparkles" },
    { name: "Freelance", iconId: "laptop" },
    {
      name: "Investment income",
      iconId: "trending",
      children: [
        { name: "Dividends", iconId: "trending" },
        { name: "Interest", iconId: "percent" },
      ],
    },
    { name: "Gifts received", iconId: "gift" },
    { name: "Sale of items", iconId: "hand-coins" },
    { name: "Other income", iconId: "banknote" },
  ],
};
