import { randomUUID } from "crypto";
import { ChatPoll, ChatPollOption } from "@chatapp/shared";

const MAX_QUESTION_LENGTH = 200;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;
const MAX_OPTION_LENGTH = 80;

export type CreatePollResult = { success: true; poll: ChatPoll } | { success: false; error: string };
export type VotePollResult = { success: true; poll: ChatPoll } | { success: false; error: string };

/**
 * Tinder's real "System to create a two-person poll in chat" (#327) — a
 * custom question + options the creator writes on the spot, distinct
 * from #214's DailyPollStore (one public, everyone-vs-everyone question
 * per UTC day) and #215's CoupleQuizStore (a fixed, pre-written set of
 * relationship-views questions): this is a free-form question scoped to
 * exactly the two people in the chat that started it, same "attached to
 * the message, mutated in place as votes come in" shape as #148's
 * ticTacToe.ts.
 */
export function createPoll(creator: unknown, recipient: unknown, question: unknown, options: unknown): CreatePollResult {
  const creatorName = typeof creator === "string" ? creator.trim() : "";
  const recipientName = typeof recipient === "string" ? recipient.trim() : "";
  if (!creatorName || !recipientName) {
    return { success: false, error: "creator and recipient are required" };
  }
  if (creatorName === recipientName) {
    return { success: false, error: "Cannot create a poll with yourself" };
  }

  const questionText = typeof question === "string" ? question.trim() : "";
  if (!questionText) {
    return { success: false, error: "question is required" };
  }
  if (questionText.length > MAX_QUESTION_LENGTH) {
    return { success: false, error: `question must be ${MAX_QUESTION_LENGTH} characters or fewer` };
  }

  if (!Array.isArray(options) || options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    return { success: false, error: `options must be a list of ${MIN_OPTIONS}-${MAX_OPTIONS} choices` };
  }

  const seen = new Set<string>();
  const pollOptions: ChatPollOption[] = [];
  for (const entry of options) {
    const text = typeof entry === "string" ? entry.trim() : "";
    if (!text) {
      return { success: false, error: "Each option must be non-empty" };
    }
    if (text.length > MAX_OPTION_LENGTH) {
      return { success: false, error: `Each option must be ${MAX_OPTION_LENGTH} characters or fewer` };
    }
    if (seen.has(text.toLowerCase())) {
      return { success: false, error: "Each option must be unique" };
    }
    seen.add(text.toLowerCase());
    pollOptions.push({ id: randomUUID(), text });
  }

  return {
    success: true,
    poll: { question: questionText, options: pollOptions, creator: creatorName, recipient: recipientName, votes: {} },
  };
}

export function voteOnPoll(poll: ChatPoll, voter: unknown, optionId: unknown): VotePollResult {
  const voterName = typeof voter === "string" ? voter.trim() : "";
  if (voterName !== poll.creator && voterName !== poll.recipient) {
    return { success: false, error: "Only the two people in this poll can vote" };
  }
  if (typeof optionId !== "string" || !poll.options.some((option) => option.id === optionId)) {
    return { success: false, error: "Invalid poll option" };
  }

  return { success: true, poll: { ...poll, votes: { ...poll.votes, [voterName]: optionId } } };
}
