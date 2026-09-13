export interface CoinPackage {
  id: string;
  coins: number;
  priceCents: number;
}

/** Coffee Meets Bagel's real fixed "Beans" package catalog — a small, curated set, not an open-ended amount. */
export const COIN_PACKAGES: CoinPackage[] = [
  { id: "small", coins: 100, priceCents: 99 },
  { id: "medium", coins: 550, priceCents: 499 },
  { id: "large", coins: 1200, priceCents: 999 },
];

export type PurchaseResult = { success: true; balance: number; coinPackage: CoinPackage } | { success: false; error: string };
export type SpendResult = { success: true; balance: number } | { success: false; error: string };

function findPackage(packageId: unknown): CoinPackage | undefined {
  return COIN_PACKAGES.find((p) => p.id === packageId);
}

/**
 * Coffee Meets Bagel's real "Purchase in-app coin/token packages" (#196)
 * — a real per-author coin balance backing a fixed, curated package
 * catalog (matching the reference app's own "quality over quantity"
 * philosophy — a handful of packages, not an arbitrary top-up amount).
 * This app has no payment processor to actually charge for a package
 * (same disclosed gap as pricingPlans.ts, subscriptions.ts), so
 * purchasing one credits the balance immediately, self-service. spend()
 * is real, general-purpose debit infrastructure — #197's "send virtual
 * gifts using coins" is the first feature to actually call it.
 */
export class CoinStore {
  private balanceByAuthor = new Map<string, number>();

  getBalance(author: string): number {
    return this.balanceByAuthor.get(author) ?? 0;
  }

  purchase(author: unknown, packageId: unknown): PurchaseResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };
    const coinPackage = findPackage(packageId);
    if (!coinPackage) return { success: false, error: `packageId must be one of: ${COIN_PACKAGES.map((p) => p.id).join(", ")}` };

    const balance = this.getBalance(authorText) + coinPackage.coins;
    this.balanceByAuthor.set(authorText, balance);
    return { success: true, balance, coinPackage };
  }

  spend(author: unknown, amount: unknown): SpendResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };
    if (typeof amount !== "number" || !Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
      return { success: false, error: "amount must be a positive integer" };
    }
    const currentBalance = this.getBalance(authorText);
    if (amount > currentBalance) return { success: false, error: "Insufficient coin balance" };

    const balance = currentBalance - amount;
    this.balanceByAuthor.set(authorText, balance);
    return { success: true, balance };
  }
}
