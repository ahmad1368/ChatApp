/**
 * OkCupid/Tinder-style bio keyword search (#113): a plain case-insensitive
 * substring match against #65's bio field. This app has no search index or
 * tokenizer, so a multi-word query matches only when that exact phrase
 * appears verbatim in the bio, not as a per-word AND — an honest scoping
 * call rather than building a text-search engine for one filter.
 */
export function bioMatchesKeyword(bio: string, keyword: string): boolean {
  const trimmedKeyword = keyword.trim().toLowerCase();
  if (!trimmedKeyword) return true;
  return bio.toLowerCase().includes(trimmedKeyword);
}
