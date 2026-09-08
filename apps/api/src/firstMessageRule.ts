import { GenderOption } from "@chatapp/shared";

export type FirstMessageCheckResult = { allowed: true } | { allowed: false; error: string };

/**
 * Bumble's real "women message first" rule (#135) — in a woman/man match,
 * only the woman can send the opening message; every other pairing (two
 * women, two men, anyone non-binary/genderfluid/etc., or either side's
 * gender simply unknown) is unrestricted, matching Bumble's own actual
 * behavior since it launched same-gender matching. Pure and gender-data-
 * agnostic about *where* the two genders come from — see server.ts's
 * message:send for how they're looked up.
 */
export function canSendFirstMessage(
  senderGender: GenderOption | undefined,
  recipientGender: GenderOption | undefined
): FirstMessageCheckResult {
  const isWomanManPair =
    (senderGender === "woman" && recipientGender === "man") || (senderGender === "man" && recipientGender === "woman");
  if (!isWomanManPair) {
    return { allowed: true };
  }
  if (senderGender === "woman") {
    return { allowed: true };
  }
  return { allowed: false, error: "In a match with a woman, only she can send the first message" };
}
