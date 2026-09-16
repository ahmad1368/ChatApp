import { randomUUID, randomBytes } from "crypto";
import { CAFE_GIFT_CARD_CATALOG, CafeGiftCard, CafeGiftCardDenomination } from "@chatapp/shared";

export type SendGiftCardResult = { success: true; card: CafeGiftCard } | { success: false; error: string };
export type RedeemGiftCardResult = { success: true; card: CafeGiftCard } | { success: false; error: string };

export function findDenomination(amountDollars: unknown): CafeGiftCardDenomination | undefined {
  return CAFE_GIFT_CARD_CATALOG.find((d) => d.amountDollars === amountDollars);
}

function generateCode(): string {
  return randomBytes(6).toString("hex").toUpperCase().match(/.{1,4}/g)!.join("-");
}

/**
 * Coffee Meets Bagel's real "System to send electronic cafe gift cards"
 * (#330) — see the CAFE_GIFT_CARD_CATALOG doc comment in
 * packages/shared for the honest scoping (a real generated redemption
 * code and dollar amount, but no real gift-card-issuing API this
 * environment has credentials for). One card per id, redeemed exactly
 * once by its recipient.
 */
export class CafeGiftCardStore {
  private cardsById = new Map<string, CafeGiftCard>();

  create(sender: unknown, recipient: unknown, amountDollars: unknown): SendGiftCardResult {
    const senderName = typeof sender === "string" ? sender.trim() : "";
    const recipientName = typeof recipient === "string" ? recipient.trim() : "";
    if (!senderName || !recipientName) {
      return { success: false, error: "sender and recipient are required" };
    }
    if (senderName === recipientName) {
      return { success: false, error: "Cannot send a gift card to yourself" };
    }
    const denomination = findDenomination(amountDollars);
    if (!denomination) {
      return { success: false, error: "Invalid gift card amount" };
    }

    const card: CafeGiftCard = {
      id: randomUUID(),
      amountDollars: denomination.amountDollars,
      code: generateCode(),
      sender: senderName,
      recipient: recipientName,
      redeemed: false,
      createdAt: new Date().toISOString(),
    };
    this.cardsById.set(card.id, card);
    return { success: true, card };
  }

  redeem(cardId: string, redeemer: unknown): RedeemGiftCardResult {
    const card = this.cardsById.get(cardId);
    if (!card) {
      return { success: false, error: "Gift card not found" };
    }
    const redeemerName = typeof redeemer === "string" ? redeemer.trim() : "";
    if (redeemerName !== card.recipient) {
      return { success: false, error: "Only the recipient can redeem this gift card" };
    }
    if (card.redeemed) {
      return { success: false, error: "This gift card has already been redeemed" };
    }

    card.redeemed = true;
    return { success: true, card };
  }

  get(cardId: string): CafeGiftCard | undefined {
    return this.cardsById.get(cardId);
  }
}
