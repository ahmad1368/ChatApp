export const ATTACHMENT_STYLES = ["secure", "anxious", "avoidant", "fearful"] as const;
export type AttachmentStyle = (typeof ATTACHMENT_STYLES)[number];

export type QuizDimension = "anxiety" | "avoidance";

export interface AttachmentQuizQuestion {
  id: string;
  text: string;
  dimension: QuizDimension;
}

const MIN_ANSWER = 1;
const MAX_ANSWER = 5;
const HIGH_THRESHOLD = 3.5;

// Loosely modeled on the two-dimension (anxiety/avoidance) attachment-
// style framework used in relationship-compatibility research — written
// in this app's own words, not a licensed clinical instrument. Half the
// statements probe each dimension, 1 (strongly disagree) to 5 (strongly
// agree).
export const ATTACHMENT_QUIZ_QUESTIONS: AttachmentQuizQuestion[] = [
  { id: "a1", text: "I often worry that a partner doesn't really care about me.", dimension: "anxiety" },
  { id: "a2", text: "I need a lot of reassurance that I'm loved.", dimension: "anxiety" },
  { id: "a3", text: "I get anxious when a partner isn't available when I need them.", dimension: "anxiety" },
  { id: "a4", text: "I worry about being abandoned by people close to me.", dimension: "anxiety" },
  { id: "v1", text: "I prefer not to show a partner how I feel deep down.", dimension: "avoidance" },
  { id: "v2", text: "I find it difficult to depend on romantic partners.", dimension: "avoidance" },
  { id: "v3", text: "I get uneasy when a partner wants to get too close to me.", dimension: "avoidance" },
  { id: "v4", text: "I prefer not to be too emotionally close to romantic partners.", dimension: "avoidance" },
];

export interface AttachmentStyleResult {
  style: AttachmentStyle;
  anxietyScore: number;
  avoidanceScore: number;
  hideResult: boolean;
  completedAt: string;
}

export type SubmitQuizResult = { success: true; result: AttachmentStyleResult } | { success: false; error: string };

function classify(anxietyScore: number, avoidanceScore: number): AttachmentStyle {
  const highAnxiety = anxietyScore >= HIGH_THRESHOLD;
  const highAvoidance = avoidanceScore >= HIGH_THRESHOLD;
  if (!highAnxiety && !highAvoidance) return "secure";
  if (highAnxiety && !highAvoidance) return "anxious";
  if (!highAnxiety && highAvoidance) return "avoidant";
  return "fearful";
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * eHarmony's real "psychological tendencies based on tests" (#315) —
 * scoped to a legitimate, non-clinical relationship-attachment-style quiz
 * (the same real 2-dimension anxiety/avoidance framework relationship-
 * compatibility research and real dating/relationship apps use), never
 * "mental health status": this app deliberately does NOT display a
 * diagnosis, clinical label, or health status on a swipeable profile —
 * doing so would be a genuine discrimination/stigmatization risk with no
 * real verification behind it. The quiz result is for self-reflection
 * only, disclosed as such wherever it's shown, and hideable like every
 * other optional profile detail (#67-#76).
 */
export class AttachmentStyleStore {
  private resultsByAuthor = new Map<string, AttachmentStyleResult>();

  submitQuiz(author: unknown, answers: unknown, hideResult: unknown): SubmitQuizResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) {
      return { success: false, error: "author is required" };
    }
    if (!Array.isArray(answers) || answers.length !== ATTACHMENT_QUIZ_QUESTIONS.length) {
      return { success: false, error: `answers must be a list of ${ATTACHMENT_QUIZ_QUESTIONS.length} numbers` };
    }
    for (const answer of answers) {
      if (typeof answer !== "number" || !Number.isInteger(answer) || answer < MIN_ANSWER || answer > MAX_ANSWER) {
        return { success: false, error: `each answer must be a whole number between ${MIN_ANSWER} and ${MAX_ANSWER}` };
      }
    }

    const anxietyAnswers: number[] = [];
    const avoidanceAnswers: number[] = [];
    ATTACHMENT_QUIZ_QUESTIONS.forEach((question, i) => {
      (question.dimension === "anxiety" ? anxietyAnswers : avoidanceAnswers).push(answers[i] as number);
    });

    const anxietyScore = average(anxietyAnswers);
    const avoidanceScore = average(avoidanceAnswers);
    const result: AttachmentStyleResult = {
      style: classify(anxietyScore, avoidanceScore),
      anxietyScore,
      avoidanceScore,
      hideResult: hideResult === true,
      completedAt: new Date().toISOString(),
    };
    this.resultsByAuthor.set(authorName, result);
    return { success: true, result };
  }

  get(author: string): AttachmentStyleResult | null {
    return this.resultsByAuthor.get(author) ?? null;
  }
}
