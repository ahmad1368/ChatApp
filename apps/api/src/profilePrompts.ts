import { scanForContactInfo } from "./contactInfoDetector";

export const MAX_SELECTED_PROMPTS = 3;
export const MAX_ANSWER_LENGTH = 150;

export interface ProfilePrompt {
  id: string;
  text: string;
}

// Hinge's actual "prompts" catalog is much larger and configurable from the
// backend (per the issue's schema-driven guidance); this is a representative
// fixed subset rather than a full content-management system.
export const PROFILE_PROMPT_CATALOG: readonly ProfilePrompt[] = [
  { id: "two-truths-a-lie", text: "Two truths and a lie" },
  { id: "simple-pleasures", text: "My simple pleasures" },
  { id: "together-we-could", text: "Together, we could..." },
  { id: "worst-idea", text: "My worst idea I've ever had" },
  { id: "irrational-fear", text: "My most irrational fear" },
  { id: "unusual-skills", text: "A random fact I love" },
  { id: "typical-sunday", text: "A typical Sunday" },
  { id: "green-flags", text: "Green flags I look for" },
  { id: "dating-me-is-like", text: "Dating me is like" },
  { id: "change-my-mind", text: "Change my mind about..." },
] as const;

export interface ProfilePromptAnswer {
  promptId: string;
  answer: string;
}

export interface ResolvedProfilePromptAnswer extends ProfilePromptAnswer {
  prompt: string;
}

export type SetPromptAnswersResult =
  | { success: true; answers: ResolvedProfilePromptAnswer[] }
  | { success: false; error: string };

// Same phone-number/address rule onboarding.ts and bio.ts apply to other
// free-text profile fields — reimplemented locally since it's a private
// detail in each of those, not a shared export.
function describeContactInfo(text: string): string | undefined {
  if (!text) return undefined;
  const scan = scanForContactInfo(text);
  if (scan.containsPhoneNumber && scan.containsAddress) return "can't contain a phone number or address";
  if (scan.containsPhoneNumber) return "can't contain a phone number";
  if (scan.containsAddress) return "can't contain an address";
  return undefined;
}

function findPrompt(promptId: string): ProfilePrompt | undefined {
  return PROFILE_PROMPT_CATALOG.find((prompt) => prompt.id === promptId);
}

/**
 * Hinge-style "answer ready-made profile prompts" (#66) — a user picks up to
 * three prompts from the fixed catalog above and writes a short answer to
 * each, the same one-set-per-author, replace-on-update shape as #65's bio.
 * Turning a prompt answer into the start of a conversation happens in the
 * existing chat surface (a user viewing this profile can already message
 * them there); no separate "reply to this prompt" message type is modeled.
 */
export class ProfilePromptsStore {
  private answersByAuthor = new Map<string, ProfilePromptAnswer[]>();

  setAnswers(author: unknown, answers: unknown): SetPromptAnswersResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!Array.isArray(answers) || answers.length === 0) {
      return { success: false, error: "Select at least one prompt to answer" };
    }
    if (answers.length > MAX_SELECTED_PROMPTS) {
      return { success: false, error: `Choose at most ${MAX_SELECTED_PROMPTS} prompts` };
    }

    const seenPromptIds = new Set<string>();
    const validated: ResolvedProfilePromptAnswer[] = [];
    for (const entry of answers) {
      const promptId = typeof entry === "object" && entry !== null ? (entry as { promptId?: unknown }).promptId : undefined;
      const answerText = typeof entry === "object" && entry !== null ? (entry as { answer?: unknown }).answer : undefined;

      const prompt = typeof promptId === "string" ? findPrompt(promptId) : undefined;
      if (!prompt) {
        return { success: false, error: "Invalid prompt selected" };
      }
      if (seenPromptIds.has(prompt.id)) {
        return { success: false, error: "Each prompt can only be selected once" };
      }
      seenPromptIds.add(prompt.id);

      const trimmedAnswer = typeof answerText === "string" ? answerText.trim() : "";
      if (!trimmedAnswer) {
        return { success: false, error: "Prompt answers can't be empty" };
      }
      if (trimmedAnswer.length > MAX_ANSWER_LENGTH) {
        return { success: false, error: `Prompt answers must be ${MAX_ANSWER_LENGTH} characters or fewer` };
      }
      const contactInfoError = describeContactInfo(trimmedAnswer);
      if (contactInfoError) {
        return { success: false, error: `Prompt answer ${contactInfoError}` };
      }

      validated.push({ promptId: prompt.id, answer: trimmedAnswer, prompt: prompt.text });
    }

    this.answersByAuthor.set(
      authorName,
      validated.map(({ promptId, answer }) => ({ promptId, answer }))
    );
    return { success: true, answers: validated };
  }

  getAnswers(author: string): ResolvedProfilePromptAnswer[] {
    const stored = this.answersByAuthor.get(author) ?? [];
    return stored.map(({ promptId, answer }) => ({ promptId, answer, prompt: findPrompt(promptId)?.text ?? promptId }));
  }
}
