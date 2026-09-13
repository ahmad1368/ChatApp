import { randomUUID } from "crypto";

export const TRANSACTION_TYPES = ["purchase", "refund"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

const MAX_DESCRIPTION_LENGTH = 200;
const MAX_REASON_LENGTH = 200;

export interface Transaction {
  id: string;
  author: string;
  type: TransactionType;
  amountCents: number;
  description: string;
  createdAt: string;
  relatedTransactionId?: string;
  refundedAt?: string;
  refundReason?: string;
}

export type LogPurchaseResult = { success: true; transaction: Transaction } | { success: false; error: string };
export type RefundResult = { success: true; refund: Transaction } | { success: false; error: string };

export interface TransactionFilter {
  author?: string;
  type?: TransactionType;
}

/**
 * Tinder's real "Detailed logging of all financial transactions and
 * refunds" (#185). This app has no integrated payment processor yet
 * (#191-196 are still open, same disclosed gap as pricingPlans.ts's
 * "no premium tier to gate it behind") — so there's no automatic
 * charge event to hook into. This is the ledger backbone those
 * features will write to once they land; until then it's a real
 * admin-facing manual ledger (an admin logs a purchase actually
 * processed out-of-band, e.g. an invoice, and can issue a refund
 * against it), gated the same admin-key way as #171-184.
 */
export class TransactionLogStore {
  private byId = new Map<string, Transaction>();

  logPurchase(author: unknown, amountCents: unknown, description: unknown): LogPurchaseResult {
    const authorText = typeof author === "string" ? author.trim() : "";
    if (!authorText) return { success: false, error: "author is required" };
    if (typeof amountCents !== "number" || !Number.isFinite(amountCents) || !Number.isInteger(amountCents) || amountCents <= 0) {
      return { success: false, error: "amountCents must be a positive integer" };
    }
    const descriptionText = typeof description === "string" ? description.trim() : "";
    if (!descriptionText) return { success: false, error: "description is required" };
    if (descriptionText.length > MAX_DESCRIPTION_LENGTH) {
      return { success: false, error: `description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` };
    }

    const transaction: Transaction = {
      id: randomUUID(),
      author: authorText,
      type: "purchase",
      amountCents,
      description: descriptionText,
      createdAt: new Date().toISOString(),
    };
    this.byId.set(transaction.id, transaction);
    return { success: true, transaction };
  }

  refund(transactionId: string, reason: unknown): RefundResult {
    const original = this.byId.get(transactionId);
    if (!original) return { success: false, error: "Transaction not found" };
    if (original.type !== "purchase") return { success: false, error: "Only a purchase can be refunded" };
    if (original.refundedAt) return { success: false, error: "That purchase was already refunded" };

    const reasonText = typeof reason === "string" ? reason.trim() : "";
    if (!reasonText) return { success: false, error: "reason is required" };
    if (reasonText.length > MAX_REASON_LENGTH) return { success: false, error: `reason must be ${MAX_REASON_LENGTH} characters or fewer` };

    const now = new Date().toISOString();
    original.refundedAt = now;
    original.refundReason = reasonText;

    const refundEntry: Transaction = {
      id: randomUUID(),
      author: original.author,
      type: "refund",
      amountCents: -original.amountCents,
      description: `Refund: ${reasonText}`,
      createdAt: now,
      relatedTransactionId: original.id,
    };
    this.byId.set(refundEntry.id, refundEntry);
    return { success: true, refund: refundEntry };
  }

  /** Every transaction and refund entry, newest first — the admin ledger view. */
  list(filter?: TransactionFilter): Transaction[] {
    let entries = [...this.byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter?.author) entries = entries.filter((t) => t.author === filter.author);
    if (filter?.type) entries = entries.filter((t) => t.type === filter.type);
    return entries;
  }

  get(transactionId: string): Transaction | undefined {
    return this.byId.get(transactionId);
  }
}
