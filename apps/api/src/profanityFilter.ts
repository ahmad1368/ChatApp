import { PROFANITY_WORDS } from "./contentWarning";

export interface ProfanityFilterResult {
  filtered: string;
  wasFiltered: boolean;
}

// "f" + asterisks for the rest, so the masked word is still recognizable
// as censorship rather than gibberish — matches the familiar "f***"
// convention rather than replacing the whole word with a generic token.
function maskWord(word: string): string {
  if (word.length <= 1) return "*".repeat(word.length);
  return word[0] + "*".repeat(word.length - 1);
}

/**
 * Bumble's real "Automatic filtering system for inappropriate words and
 * profanity" (#176) — reuses #143's PROFANITY_WORDS list (contentWarning.ts)
 * but is a genuinely different mechanism: silent, automatic masking
 * rather than an interactive "are you sure?" warning. #143's chat-message
 * warning already gives senders a chance to edit or confirm, so this
 * filter is applied where no such flow exists — profile text fields
 * (bio, nickname) — rather than double-handling the same chat text two
 * conflicting ways. Same "reuse a real signal, don't fabricate an ML
 * model" honesty as the rest of this app's moderation features.
 */
export function filterProfanity(text: string): ProfanityFilterResult {
  let wasFiltered = false;
  const filtered = text.replace(/[A-Za-z']+/g, (word) => {
    if (PROFANITY_WORDS.includes(word.toLowerCase())) {
      wasFiltered = true;
      return maskWord(word);
    }
    return word;
  });
  return { filtered, wasFiltered };
}
